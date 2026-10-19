import type { CreateTaskInput, Me, Task, TaskListResponse, UpdateTaskInput } from '@epiuse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';

/** The signed-in person, their manager and their direct reports (ADR-0022). */
export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => apiFetch<Me>('/me') });

const taskKeys = { team: ['tasks', 'team'] as const };

/**
 * The person's own tasks, then each direct report's. One request serves both tabs on the
 * home screen, and the open counts beside each team member.
 */
export const useTeamTasks = (enabled: boolean) =>
  useQuery({
    queryKey: taskKeys.team,
    queryFn: () => apiFetch<TaskListResponse>('/me/tasks?scope=team'),
    enabled,
  });

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Pick<CreateTaskInput, 'title'>) =>
      apiFetch<Task>('/me/tasks', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.team }),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateTaskInput }) =>
      apiFetch<Task>(`/me/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.team }),
  });
}
