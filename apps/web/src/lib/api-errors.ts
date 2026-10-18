import { ApiRequestError } from './api-client';

/** A user-facing sentence for any failure: the API's own message where there is one. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  return 'Something went wrong. Check your connection and try again.';
}

/** Field-level problems from a 400 VALIDATION_FAILED, keyed by field path. */
export function fieldIssues(error: unknown): Record<string, string> {
  if (!(error instanceof ApiRequestError) || error.code !== 'VALIDATION_FAILED') return {};
  const issues = (error.details as { issues?: { path: string; message: string }[] } | undefined)
    ?.issues;
  return Object.fromEntries((issues ?? []).map((i) => [i.path, i.message]));
}
