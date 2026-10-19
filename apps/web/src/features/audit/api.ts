import type { AuditAction, AuditEntry, Paginated } from '@epiuse/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

const PAGE_SIZE = 50;

/** The audit trail, newest first, a page at a time; filtered by change type on the server. */
export function useAuditTrail(action: AuditAction | undefined) {
  return useInfiniteQuery({
    queryKey: ['audit', action ?? 'all'],
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams({ page: String(pageParam), pageSize: String(PAGE_SIZE) });
      if (action) query.set('action', action);
      return apiFetch<Paginated<AuditEntry>>(`/audit?${query}`);
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}
