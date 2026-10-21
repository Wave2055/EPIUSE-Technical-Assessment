import { z } from 'zod';
import { EmployeeRefSchema, EmployeeSchema } from './employee.js';

export const RoleSchema = z.enum(['ADMIN', 'VIEWER']);
export type Role = z.infer<typeof RoleSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Enter the email address you sign in with.')),
  password: z.string().min(1, 'Enter your password.').max(200),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const AuthUserSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: RoleSchema,
  /** The employee record this login belongs to (ADR-0022, ADR-0036). */
  employeeId: z.uuid().nullable(),
  /** Signed in with a one-time password: must choose their own before anything else. */
  mustChangePassword: z.boolean(),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export const AccessTokenResponseSchema = z.object({
  accessToken: z.string(),
  /** Seconds until the access token expires. */
  expiresIn: z.number().int(),
  user: AuthUserSchema,
});
export type AccessTokenResponse = z.infer<typeof AccessTokenResponseSchema>;

/** `GET /me`: everything the home screen needs about the signed-in person. */
export const MeSchema = z.object({
  user: AuthUserSchema,
  employee: EmployeeSchema.nullable(),
  manager: EmployeeRefSchema.nullable(),
  directReports: z.array(EmployeeSchema),
});
export type Me = z.infer<typeof MeSchema>;
