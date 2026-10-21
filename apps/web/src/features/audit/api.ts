import type {
  AuditAction,
  AuditEntry,
  Paginated,
  UserAuditAction,
  UserAuditEntry,
} from '@epiuse/shared';
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

/** The account trail (ADR-0036): logins created, roles, deactivations and passwords. */
export function useAccountTrail(action: UserAuditAction | undefined) {
  return useInfiniteQuery({
    queryKey: ['audit', 'accounts', action ?? 'all'],
    queryFn: ({ pageParam }) => {
      const query = new URLSearchParams({ page: String(pageParam), pageSize: String(PAGE_SIZE) });
      if (action) query.set('action', action);
      return apiFetch<Paginated<UserAuditEntry>>(`/audit/accounts?${query}`);
    },
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
  });
}
