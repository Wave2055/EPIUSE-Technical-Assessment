import { ApiRequestError } from './api-client';

/**
 * A sentence for the user. API errors already carry one (`{ code, message }`, ADR-0004);
 * anything else is either the network or a bug, and is described as such.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof TypeError) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return 'Something went wrong. Please try again.';
}
