import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiError as ApiErrorBody, ErrorCode } from '@epiuse/shared';
import type { Response } from 'express';
import { Prisma } from '../../generated/prisma/client.js';
import { ApiError } from '../errors/api-error.js';

/** SQLSTATE raised by the cycle trigger (see the init migration). */
const CYCLE_SQLSTATE = 'HC001';

const STATUS_CODES: Partial<Record<number, ErrorCode>> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
};

const FIELD_LABELS: Record<string, string> = {
  employee_number: 'employee number',
  employeeNumber: 'employee number',
  email: 'email address',
};

/** Shapes every error into `{ code, message, details }` (ADR-0004). */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const error = this.toApiError(exception);
    if (error.status >= 500) this.logger.error(exception);

    const body: ApiErrorBody = { code: error.code, message: error.message };
    if (error.details !== undefined) body.details = error.details;
    host.switchToHttp().getResponse<Response>().status(error.status).json(body);
  }

  private toApiError(exception: unknown): ApiError {
    if (exception instanceof ApiError) return exception;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return new ApiError(status, STATUS_CODES[status] ?? 'INTERNAL', exception.message);
    }

    // The trigger is the correctness boundary (ADR-0008). Reaching it means the service
    // check was bypassed or raced, so the path is unknown; the refusal still stands.
    if (hasSqlState(exception, CYCLE_SQLSTATE)) {
      return new ApiError(422, 'HIERARCHY_CYCLE', 'That change would create a reporting loop.');
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': {
          const fields = uniqueFields(exception).map((f) => FIELD_LABELS[f] ?? f);
          const what = fields.length > 0 ? fields.join(' and ') : 'value';
          return new ApiError(409, 'CONFLICT', `Another record already uses that ${what}.`, {
            fields,
          });
        }
        case 'P2025':
          return new ApiError(404, 'NOT_FOUND', 'That record was not found.');
        case 'P2003':
          return new ApiError(409, 'CONFLICT', 'Other records still depend on this one.');
      }
    }

    return new ApiError(HttpStatus.INTERNAL_SERVER_ERROR, 'INTERNAL', 'Something went wrong.');
  }
}

/** Driver-adapter errors nest the Postgres code at varying depths, so search for it. */
function hasSqlState(error: unknown, code: string, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 5) return false;
  const record = error as Record<string, unknown>;
  if (record.code === code || record.originalCode === code) return true;
  if (typeof record.message === 'string' && record.message.includes(code)) return true;
  return Object.values(record).some((v) => hasSqlState(v, code, depth + 1));
}

function uniqueFields(error: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = error.meta as
    | {
        target?: string[] | string;
        driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } };
      }
    | undefined;
  const target = meta?.target ?? meta?.driverAdapterError?.cause?.constraint?.fields ?? [];
  return (Array.isArray(target) ? target : [target]).map((f) => f.replace(/"/g, ''));
}
