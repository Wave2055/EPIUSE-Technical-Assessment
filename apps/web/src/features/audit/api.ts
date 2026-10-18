import type { AuditAction, AuditEntry, Paginated } from '@epiuse/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiGet, toQuery } from '@/lib/api-client';

export function useAudit(params: { action?: AuditAction; page: number; pageSize: number }) {
  return useQuery({
    queryKey: ['audit', params],
    queryFn: () => apiGet<Paginated<AuditEntry>>(`/audit${toQuery(params)}`),
    placeholderData: keepPreviousData,
  });
}
