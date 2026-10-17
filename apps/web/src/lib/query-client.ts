import { QueryClient } from '@tanstack/react-query';

/**
 * Server state lives here rather than in component state, so a mutation can invalidate the
 * org chart and the reporting table together (ADR-0005).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
