import type {
  TemporaryPassword,
  UpdateUserInput,
  UserListResponse,
  UserSummary,
} from '@epiuse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

const usersKey = ['users'] as const;

/** Every login, with its employee and status (ADR-0036). Admins only. */
export const useUsers = () =>
  useQuery({ queryKey: usersKey, queryFn: () => apiFetch<UserListResponse>('/users') });

/** Promote, demote, deactivate or reactivate. */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateUserInput }) =>
      apiFetch<UserSummary>(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: usersKey }),
        queryClient.invalidateQueries({ queryKey: ['audit'] }),
      ]),
  });
}

/** Issues a new one-time password, returned once. */
export function useResetPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<TemporaryPassword>(`/users/${id}/reset-password`, { method: 'POST' }),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: usersKey }),
        queryClient.invalidateQueries({ queryKey: ['audit'] }),
      ]),
  });
}
