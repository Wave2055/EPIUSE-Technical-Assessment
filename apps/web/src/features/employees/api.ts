import {
  AVATAR_CONTENT_TYPES,
  AVATAR_MAX_BYTES,
  type AvatarUploadRequest,
  type AvatarUploadResponse,
  type CreateEmployeeInput,
  type CreateEmployeeResponse,
  type Employee,
  type Paginated,
  type TemporaryPassword,
} from '@epiuse/shared';
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

/**
 * Create when `id` is absent, otherwise update, including re-parenting (ADR-0008). Creating
 * also creates the employee's login, whose one-time password comes back once as `login`
 * (ADR-0036).
 */
export function useSaveEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id?: string;
      input: CreateEmployeeInput;
    }): Promise<{ employee: Employee; login: TemporaryPassword | null }> => {
      if (id) {
        const employee = await apiFetch<Employee>(`/employees/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        });
        return { employee, login: null };
      }
      return apiFetch<CreateEmployeeResponse>('/employees', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: () =>
      Promise.all([
        invalidateAfterChange(queryClient),
        queryClient.invalidateQueries({ queryKey: ['users'] }),
      ]),
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

/** An upload problem worded for the user, as API errors already are. */
export class AvatarUploadError extends Error {
  override name = 'AvatarUploadError';
}

/** A picture the browser can tell is unusable before anything is sent; `null` when fine. */
export function avatarFileProblem(file: File): string | null {
  if (!(AVATAR_CONTENT_TYPES as readonly string[]).includes(file.type)) {
    return 'Choose a PNG, JPEG or WebP image.';
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return `Choose an image under ${AVATAR_MAX_BYTES / 1024 / 1024} MB.`;
  }
  return null;
}

/**
 * The three-step upload (ADR-0013): the API signs a POST, the browser sends the file
 * straight to S3, then the API checks it landed and points the employee at it. S3 enforces
 * the type and size again, so the checks above are for a friendlier message only.
 */
export async function uploadAvatar(id: string, file: File): Promise<Employee> {
  const problem = avatarFileProblem(file);
  if (problem) throw new AvatarUploadError(problem);

  const request: AvatarUploadRequest = {
    contentType: file.type as AvatarUploadRequest['contentType'],
  };
  const upload = await apiFetch<AvatarUploadResponse>(`/employees/${id}/avatar/upload-url`, {
    method: 'POST',
    body: JSON.stringify(request),
  });

  // S3 reads the policy fields first and the file last.
  const form = new FormData();
  for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
  form.append('file', file);
  const response = await fetch(upload.url, { method: 'POST', body: form });
  if (!response.ok) {
    throw new AvatarUploadError('The picture could not be uploaded. Please try again.');
  }

  return apiFetch<Employee>(`/employees/${id}/avatar`, {
    method: 'PATCH',
    body: JSON.stringify({ key: upload.key }),
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => uploadAvatar(id, file),
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}

/** Back to Gravatar, or initials when there is none. */
export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<Employee>(`/employees/${id}/avatar`, { method: 'DELETE' }),
    onSuccess: () => invalidateAfterChange(queryClient),
  });
}
