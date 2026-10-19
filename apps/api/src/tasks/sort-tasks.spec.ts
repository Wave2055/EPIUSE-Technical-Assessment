import { compareTasks } from './sort-tasks.js';

const task = (title: string, status: 'todo' | 'in_progress' | 'done', due: string | null) => ({
  title,
  status,
  dueDate: due ? new Date(due) : null,
  createdAt: new Date('2026-10-01'),
});

describe('compareTasks', () => {
  it('orders in progress, then to-do, then done; earliest due first; undated last', () => {
    const sorted = [
      task('done', 'done', '2026-10-01'),
      task('todo undated', 'todo', null),
      task('todo late', 'todo', '2026-10-30'),
      task('todo soon', 'todo', '2026-10-20'),
      task('doing', 'in_progress', '2026-11-01'),
    ].sort(compareTasks);
    expect(sorted.map((t) => t.title)).toEqual([
      'doing',
      'todo soon',
      'todo late',
      'todo undated',
      'done',
    ]);
  });
});
