import type { ErrorCode } from '@epiuse/shared';

/**
 * A failure the client is meant to understand. The exception filter turns it into the
 * shared `{ code, message, details }` body; anything else becomes a 500.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', `${what} was not found.`);

export const forbidden = (message = 'You do not have permission to do that.') =>
  new ApiError(403, 'FORBIDDEN', message);

/** ADR-0008: the service-layer check exists to name the loop, not just refuse it. */
export class HierarchyCycleError extends ApiError {
  constructor(path: string[]) {
    super(
      422,
      'HIERARCHY_CYCLE',
      `That change would create a reporting loop: ${path.join(' → ')}.`,
      { path },
    );
  }
}
