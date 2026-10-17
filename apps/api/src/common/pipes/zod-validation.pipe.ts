import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ApiError } from '../errors/api-error.js';

/**
 * Validates a body, query or param against a shared zod schema (ADR-0003) and hands the
 * handler the parsed, transformed value.
 */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw new ApiError(400, 'VALIDATION_FAILED', 'Some of the values sent are not valid.', {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }
}
