import { describe, expect, it } from 'vitest';
import { AvatarUploadRequestSchema } from './avatar.js';
import { LoginSchema } from './auth.js';
import { UpdateEmployeeSchema } from './employee.js';
import { ApiErrorSchema } from './errors.js';
import { PageQuerySchema } from './pagination.js';
import { CreateTaskSchema, TaskScopeQuerySchema, UpdateTaskSchema } from './task.js';

/**
 * Edge cases of the shared schemas. Both ends validate with these (ADR-0003), so a gap here
 * is a gap in the API and the web form at once.
 */
const fails = (result: { success: boolean }) => expect(result.success).toBe(false);

describe('LoginSchema', () => {
  it('trims and lower-cases the email', () => {
    expect(LoginSchema.parse({ email: '  Admin@Example.COM ', password: 'x' }).email).toBe(
      'admin@example.com',
    );
  });

  it('refuses an empty password and one longer than 200 characters', () => {
    fails(LoginSchema.safeParse({ email: 'a@example.com', password: '' }));
    fails(LoginSchema.safeParse({ email: 'a@example.com', password: 'x'.repeat(201) }));
  });

  it('keeps the password exactly as typed, spaces included', () => {
    expect(LoginSchema.parse({ email: 'a@example.com', password: ' pass ' }).password).toBe(
      ' pass ',
    );
  });
});

describe('UpdateEmployeeSchema', () => {
  it('refuses an empty change', () => {
    fails(UpdateEmployeeSchema.safeParse({}));
  });

  it('accepts a single field, including clearing the manager', () => {
    expect(UpdateEmployeeSchema.parse({ managerId: null })).toEqual({ managerId: null });
    expect(UpdateEmployeeSchema.parse({ position: ' Lead ' })).toEqual({ position: 'Lead' });
  });

  it('drops unknown fields rather than passing them through', () => {
    expect(UpdateEmployeeSchema.parse({ position: 'Lead', salary: 1, id: 'x' })).not.toHaveProperty(
      'id',
    );
  });
});

describe('PageQuerySchema', () => {
  it('coerces query-string numbers and applies defaults', () => {
    expect(PageQuerySchema.parse({ page: '2', pageSize: '25' })).toEqual({ page: 2, pageSize: 25 });
    expect(PageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 50 });
  });

  it.each([['0'], ['-1'], ['1.5'], ['abc']])('refuses page %s', (page) => {
    fails(PageQuerySchema.safeParse({ page }));
  });

  it('caps the page size at 500', () => {
    expect(PageQuerySchema.parse({ pageSize: '500' }).pageSize).toBe(500);
    fails(PageQuerySchema.safeParse({ pageSize: '501' }));
  });
});

describe('task schemas', () => {
  it('defaults a new task to to-do with no due date, for the caller', () => {
    expect(CreateTaskSchema.parse({ title: ' Plan ' })).toEqual({
      title: 'Plan',
      status: 'todo',
      dueDate: null,
    });
  });

  it.each([
    ['a blank title', { title: '  ' }],
    ['a 201-character title', { title: 'x'.repeat(201) }],
    ['an impossible due date', { title: 'Plan', dueDate: '2026-13-01' }],
    ['an unknown status', { title: 'Plan', status: 'blocked' }],
    ['an assignee that is not a uuid', { title: 'Plan', employeeId: 'boss' }],
  ])('refuses %s', (_label, input) => {
    fails(CreateTaskSchema.safeParse(input));
  });

  it('accepts a 200-character title', () => {
    expect(CreateTaskSchema.safeParse({ title: 'x'.repeat(200) }).success).toBe(true);
  });

  it('refuses an empty update but allows clearing the due date', () => {
    fails(UpdateTaskSchema.safeParse({}));
    expect(UpdateTaskSchema.parse({ dueDate: null })).toEqual({ dueDate: null });
  });

  it('defaults the task scope to mine and refuses anything but mine or team', () => {
    expect(TaskScopeQuerySchema.parse({}).scope).toBe('mine');
    fails(TaskScopeQuerySchema.safeParse({ scope: 'all' }));
  });
});

describe('AvatarUploadRequestSchema', () => {
  it('accepts the three image types and nothing else', () => {
    for (const contentType of ['image/png', 'image/jpeg', 'image/webp']) {
      expect(AvatarUploadRequestSchema.safeParse({ contentType }).success).toBe(true);
    }
    for (const contentType of ['image/svg+xml', 'image/gif', 'text/html']) {
      fails(AvatarUploadRequestSchema.safeParse({ contentType }));
    }
  });
});

describe('ApiErrorSchema', () => {
  it('accepts every error the API sends, and refuses an unknown code', () => {
    expect(ApiErrorSchema.safeParse({ code: 'PAYLOAD_TOO_LARGE', message: 'x' }).success).toBe(
      true,
    );
    fails(ApiErrorSchema.safeParse({ code: 'TEAPOT', message: 'x' }));
  });
});
