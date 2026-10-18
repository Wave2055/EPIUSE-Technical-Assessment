import type {
  CreateTaskInput,
  Me,
  Task,
  TaskListResponse,
  TaskScope,
  UpdateTaskInput,
} from '@epiuse/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiSend } from '@/lib/api-client';

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => apiGet<Me>('/me') });
}

export function useTasks(scope: TaskScope, enabled = true) {
  return useQuery({
    queryKey: ['tasks', scope],
    queryFn: () => apiGet<TaskListResponse>(`/me/tasks?scope=${scope}`),
    enabled,
  });
}

function useInvalidateTasks() {
  const client = useQueryClient();
  return () => client.invalidateQueries({ queryKey: ['tasks'] });
}

export function useCreateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: (input: CreateTaskInput) => apiSend<Task>('POST', '/me/tasks', input),
    onSuccess: invalidate,
  });
}

export function useUpdateTask() {
  const invalidate = useInvalidateTasks();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      apiSend<Task>('PATCH', `/me/tasks/${id}`, input),
    onSuccess: invalidate,
  });
}
