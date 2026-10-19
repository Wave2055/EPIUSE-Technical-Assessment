import { QueryClient } from '@tanstack/react-query';
import { ApiRequestError } from './api-client';

/**
 * Server state lives here rather than in component state, so a mutation can invalidate the
 * org chart and the reporting table together (ADR-0005).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A 4xx will not fix itself on retry; a dropped connection or a 5xx might.
      retry: (failures, error) =>
        failures < 1 && !(error instanceof ApiRequestError && error.status < 500),
      refetchOnWindowFocus: false,
    },
  },
});
