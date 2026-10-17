import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';

/**
 * Salary masking is enforced here, in the API, not by hiding a column in the UI: a VIEWER's
 * browser never receives the value (ADR-0014). Every `salary` key in the response becomes
 * `null`, wherever it is nested.
 */
@Injectable()
export class SalaryMaskInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const user = context.switchToHttp().getRequest<Request>().user;
    if (user?.role === 'ADMIN') return next.handle();
    return next.handle().pipe(map(maskSalary));
  }
}

export function maskSalary(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(maskSalary);
  if (value === null || typeof value !== 'object' || value.constructor !== Object) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, v]) => [key, key === 'salary' ? null : maskSalary(v)]),
  );
}
