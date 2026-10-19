import type { CreateEmployeeInput, Employee, Paginated } from '@epiuse/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { DeleteStrategy } from './types';

export const employeeKeys = { all: ['employees'] as const };

/** The API's largest page. Fetched in full, so tables, chart and pickers share one list. */
const PAGE_SIZE = 500;

/**
 * Every employee, in name order. The table, org chart and manager pickers all work on the
 * whole organisation, so it is loaded once and shared; page by page, so a large one is
 * still complete.
 */
async function fetchAllEmployees(): Promise<Employee[]> {
  const all: Employee[] = [];
  for (let page = 1; ; page++) {
    const result = await apiFetch<Paginated<Employee>>(
      `/employees?page=${page}&pageSize=${PAGE_SIZE}&sort=name:asc`,
    );
    all.push(...result.items);
    if (all.length >= result.total || result.items.length === 0) return all;
  }
}

/** Salaries arrive already masked for a VIEWER (ADR-0014). */
export const useEmployeesQuery = () =>
  useQuery({ queryKey: employeeKeys.all, queryFn: fetchAllEmployees });

const NO_EMPLOYEES: Employee[] = [];

/** The employee list for components rendered once it has loaded. */
export const useEmployees = (): Employee[] => useEmployeesQuery().data ?? NO_EMPLOYEES;

/** An employee change also moves the org chart, the audit trail and the home screen. */
function invalidateAfterChange(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
    queryClient.invalidateQueries({ queryKey: ['audit'] }),
    queryClient.invalidateQueries({ queryKey: ['me'] }),
  ]);
}

/** Create when `id` is absent, otherwise update, including re-parenting (ADR-0008). */
export function useSaveEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: CreateEmployeeInput }) =>
      apiFetch<Employee>(id ? `/employees/${id}` : '/employees', {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}

/** Direct reports move up a level (`promote`) or to a chosen manager (`reassign`, ADR-0010). */
export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      strategy,
      reassignTo,
    }: {
      id: string;
      strategy: DeleteStrategy;
      reassignTo?: string;
    }) => {
      const query = new URLSearchParams({ strategy });
      if (strategy === 'reassign' && reassignTo) query.set('reassignTo', reassignTo);
      return apiFetch<void>(`/employees/${id}?${query}`, { method: 'DELETE' });
    },
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}
