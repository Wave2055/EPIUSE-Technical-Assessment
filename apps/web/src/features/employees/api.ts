import type {
  CreateEmployeeInput,
  DeleteEmployeeQuery,
  Employee,
  HierarchyResponse,
  Paginated,
  UpdateEmployeeInput,
} from '@epiuse/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiSend, toQuery } from '@/lib/api-client';

export interface EmployeeListParams {
  q?: string;
  sort: string;
  position?: string;
  managerId?: string;
  page: number;
  pageSize: number;
}

export const employeeKeys = {
  all: ['employees'] as const,
  list: (params: EmployeeListParams) => ['employees', 'list', params] as const,
  detail: (id: string) => ['employees', 'detail', id] as const,
};

/** The reporting table: the API searches, sorts, filters and pages. */
export function useEmployeeList(params: EmployeeListParams) {
  return useQuery({
    queryKey: employeeKeys.list(params),
    queryFn: () => apiGet<Paginated<Employee>>(`/employees${toQuery({ ...params })}`),
    // Keep the current page on screen while the next sort or filter loads.
    placeholderData: keepPreviousData,
  });
}

export function useEmployee(id: string | null) {
  return useQuery({
    queryKey: employeeKeys.detail(id ?? ''),
    queryFn: () => apiGet<Employee>(`/employees/${id}`),
    enabled: id !== null,
  });
}

/** Every employee as an org chart node; also feeds manager and role pickers. */
export function useHierarchy() {
  return useQuery({
    queryKey: ['hierarchy'],
    queryFn: () => apiGet<HierarchyResponse>('/hierarchy'),
  });
}

/**
 * An employee change can show up on every screen, so all of them refetch. A deleted
 * employee's own record is dropped instead, since refetching it can only 404.
 */
function useInvalidateEmployeeViews() {
  const client = useQueryClient();
  return (deletedId?: string) => {
    if (deletedId) client.removeQueries({ queryKey: employeeKeys.detail(deletedId) });
    return Promise.all(
      [employeeKeys.all, ['hierarchy'], ['me'], ['tasks'], ['audit']].map((queryKey) =>
        client.invalidateQueries({
          queryKey,
          predicate: (query) => !deletedId || query.queryKey[2] !== deletedId,
        }),
      ),
    );
  };
}

export function useSaveEmployee() {
  const invalidate = useInvalidateEmployeeViews();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id?: string;
      input: CreateEmployeeInput | UpdateEmployeeInput;
    }) =>
      id
        ? apiSend<Employee>('PATCH', `/employees/${id}`, input)
        : apiSend<Employee>('POST', '/employees', input),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteEmployee() {
  const invalidate = useInvalidateEmployeeViews();
  return useMutation({
    mutationFn: ({ id, query }: { id: string; query: DeleteEmployeeQuery }) =>
      apiSend<void>('DELETE', `/employees/${id}${toQuery(query)}`),
    onSuccess: (_, { id }) => invalidate(id),
  });
}
