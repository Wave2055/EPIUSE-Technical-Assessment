import { describe, expect, it } from 'vitest';
import { makeTask } from '@/test/fixtures';
import { isOverdue, sortTasks } from './tasks';

const today = new Date(2026, 9, 20, 15, 30);

describe('isOverdue', () => {
  it('counts a task due yesterday, but not one due today', () => {
    expect(isOverdue(makeTask({ dueDate: '2026-10-19' }), today)).toBe(true);
    expect(isOverdue(makeTask({ dueDate: '2026-10-20' }), today)).toBe(false);
  });

  it('never counts a finished or undated task', () => {
    expect(isOverdue(makeTask({ dueDate: '2020-01-01', status: 'done' }), today)).toBe(false);
    expect(isOverdue(makeTask({ dueDate: null }), today)).toBe(false);
  });
});

describe('sortTasks', () => {
  it('orders in progress, then to-do, then done; earliest due first; undated last', () => {
    const tasks = [
      makeTask({ title: 'done', status: 'done', dueDate: '2026-01-01' }),
      makeTask({ title: 'todo undated', status: 'todo' }),
      makeTask({ title: 'todo late', status: 'todo', dueDate: '2026-12-01' }),
      makeTask({ title: 'todo soon', status: 'todo', dueDate: '2026-10-21' }),
      makeTask({ title: 'doing', status: 'in_progress' }),
    ];
    expect(sortTasks(tasks).map((t) => t.title)).toEqual([
      'doing',
      'todo soon',
      'todo late',
      'todo undated',
      'done',
    ]);
  });

  it('does not reorder the array it was given', () => {
    const tasks = [makeTask({ status: 'done' }), makeTask({ status: 'in_progress' })];
    const before = tasks.map((t) => t.id);
    sortTasks(tasks);
    expect(tasks.map((t) => t.id)).toEqual(before);
  });
});
