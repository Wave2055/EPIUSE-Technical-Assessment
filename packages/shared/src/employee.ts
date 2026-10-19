import { z } from 'zod';

export const EMPLOYEE_NUMBER_PATTERN = /^E-\d{4}$/;

/** Today as `YYYY-MM-DD` in local time, so "before today" means the user's today. */
const todayIso = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Lightweight reference to another employee, e.g. a manager. */
export const EmployeeRefSchema = z.object({
  id: z.uuid(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string(),
  avatarUrl: z.string().nullable(),
});
export type EmployeeRef = z.infer<typeof EmployeeRefSchema>;

export const EmployeeSchema = z.object({
  id: z.uuid(),
  employeeNumber: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  /** Required so Gravatar can be resolved (ADR-0012). */
  email: z.email(),
  birthDate: z.iso.date(),
  /** `null` when masked for a VIEWER (ADR-0014). */
  salary: z.number().nullable(),
  position: z.string(),
  managerId: z.uuid().nullable(),
  manager: EmployeeRefSchema.nullable(),
  directReportCount: z.number().int(),
  /** Resolved server-side: upload → Gravatar → null for the initials fallback (ADR-0013). */
  avatarUrl: z.string().nullable(),
  hasUploadedAvatar: z.boolean(),
});
export type Employee = z.infer<typeof EmployeeSchema>;

const employeeFields = {
  firstName: z.string().trim().min(1, 'Enter a first name.').max(100),
  lastName: z.string().trim().min(1, 'Enter a surname.').max(100),
  employeeNumber: z.string().trim().regex(EMPLOYEE_NUMBER_PATTERN, 'Use the format E-0000.'),
  email: z.string().trim().toLowerCase().pipe(z.email('Enter a valid email address.').max(254)),
  birthDate: z.iso
    .date('Use the format YYYY-MM-DD.')
    .refine((d) => d >= '1900-01-01', 'Enter a birth date after 1900.')
    .refine((d) => d < todayIso(), 'The birth date must be in the past.'),
  salary: z.number().nonnegative('Salary cannot be negative.').max(1_000_000_000),
  position: z.string().trim().min(1, 'Enter a role or position.').max(120),
  managerId: z.uuid('Choose a valid manager.').nullable(),
};

export const CreateEmployeeSchema = z.object(employeeFields);
export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;

export const UpdateEmployeeSchema = z
  .object(employeeFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Send at least one field to change.');
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;
