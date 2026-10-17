/**
 * Client-side employee shapes. Stand-ins until the shared zod schemas exist (ADR-0003), at
 * which point these become `z.infer` re-exports from `@epiuse/shared`.
 */

export type Role = 'ADMIN' | 'VIEWER';

export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  /** Required so Gravatar can be resolved (ADR-0012). */
  email: string;
  /** ISO date, `YYYY-MM-DD`. */
  birthDate: string;
  /** `null` when the API has masked it for a VIEWER (ADR-0014). */
  salary: number | null;
  position: string;
  managerId: string | null;
  /** Resolved server-side: upload → Gravatar → `null` for the initials fallback (ADR-0013). */
  avatarUrl: string | null;
}

export type EmployeeInput = Omit<Employee, 'id' | 'avatarUrl'>;

export type DeleteStrategy = 'promote' | 'reassign';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'REPARENT';

export interface AuditEntry {
  id: number;
  employeeId: string;
  employeeName: string;
  action: AuditAction;
  changedBy: string | null;
  changedAt: string;
  summary: string;
}

export type TaskStatus = 'todo' | 'in_progress' | 'done';

/**
 * A personal work item on the home screen. Not part of the brief's employee record: an
 * additional feature, to be documented as such in the technical document.
 */
export interface Task {
  id: string;
  employeeId: string;
  title: string;
  status: TaskStatus;
  /** ISO date, `YYYY-MM-DD`. */
  dueDate: string | null;
}
