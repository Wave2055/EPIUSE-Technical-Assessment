import { describe, expect, it } from 'vitest';
import { ApiRequestError } from './api-client';
import { errorMessage } from './errors';

describe('errorMessage', () => {
  it("shows the API's own sentence", () => {
    expect(errorMessage(new ApiRequestError(409, 'CONFLICT', 'That number is taken.'))).toBe(
      'That number is taken.',
    );
  });

  it('blames the network for a failed fetch', () => {
    expect(errorMessage(new TypeError('Failed to fetch'))).toMatch(/Could not reach the server/);
  });

  it('never shows a raw exception or a non-error value', () => {
    expect(errorMessage(new Error('Cannot read properties of undefined'))).toBe(
      'Something went wrong. Please try again.',
    );
    expect(errorMessage('boom')).toBe('Something went wrong. Please try again.');
    expect(errorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });
});
