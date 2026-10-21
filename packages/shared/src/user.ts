import { z } from 'zod';
import { RoleSchema } from './auth.js';
import { EmployeeSchema } from './employee.js';
import { PageQuerySchema, paginated } from './pagination.js';

/**
 * Logins (ADR-0036). Every employee has exactly one, created with them. Admins issue one-time
 * passwords, change roles and deactivate logins; there is no public sign-up.
 */

/** 12–200 characters, as for every password the system accepts. */
export const NewPasswordSchema = z
  .string()
  .min(12, 'Use at least 12 characters.')
  .max(200, 'Use at most 200 characters.');

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.').max(200),
    newPassword: NewPasswordSchema,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'Choose a password different from your current one.',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;

/**
 * `active`: can sign in. `must_change_password`: has a one-time password to replace.
 * `no_password`: none issued yet. `deactivated`: blocked by an admin.
 */
export const UserStatusSchema = z.enum([
  'active',
  'must_change_password',
  'no_password',
  'deactivated',
]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

export const UserSummarySchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: RoleSchema,
  status: UserStatusSchema,
  lastLoginAt: z.iso.datetime().nullable(),
  employee: z.object({
    id: z.uuid(),
    employeeNumber: z.string(),
    firstName: z.string(),
    lastName: z.string(),
    position: z.string(),
    avatarUrl: z.string().nullable(),
  }),
});
export type UserSummary = z.infer<typeof UserSummarySchema>;
export const UserListResponseSchema = z.object({ users: z.array(UserSummarySchema) });
export type UserListResponse = z.infer<typeof UserListResponseSchema>;

/** Promote or demote with `role`; deactivate or reactivate with `active`. */
export const UpdateUserSchema = z
  .object({ role: RoleSchema, active: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to change.');
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

/** Returned exactly once, when an admin issues it; never stored in plain text. */
export const TemporaryPasswordSchema = z.object({
  email: z.email(),
  temporaryPassword: z.string(),
});
export type TemporaryPassword = z.infer<typeof TemporaryPasswordSchema>;

/** `POST /employees`: the new employee, and the login created with them. */
export const CreateEmployeeResponseSchema = z.object({
  employee: EmployeeSchema,
  login: TemporaryPasswordSchema,
});
export type CreateEmployeeResponse = z.infer<typeof CreateEmployeeResponseSchema>;

export const UserAuditActionSchema = z.enum([
  'CREATE',
  'ROLE_CHANGE',
  'DEACTIVATE',
  'REACTIVATE',
  'PASSWORD_RESET',
  'PASSWORD_CHANGE',
  'DELETE',
]);
export type UserAuditAction = z.infer<typeof UserAuditActionSchema>;

export const UserAuditEntrySchema = z.object({
  id: z.number().int(),
  userId: z.uuid(),
  email: z.email(),
  action: UserAuditActionSchema,
  /** `null` for changes made outside the API, e.g. the migration that created the logins. */
  changedBy: z.object({ id: z.uuid(), email: z.email() }).nullable(),
  changedAt: z.iso.datetime(),
  /** For ROLE_CHANGE: `{ from, to }`. For CREATE and DELETE: `{ role }`. */
  details: z.record(z.string(), z.string()).nullable(),
});
export type UserAuditEntry = z.infer<typeof UserAuditEntrySchema>;

export const UserAuditQuerySchema = PageQuerySchema.extend({
  action: UserAuditActionSchema.optional(),
});
export type UserAuditQuery = z.infer<typeof UserAuditQuerySchema>;
export const UserAuditPageSchema = paginated(UserAuditEntrySchema);
