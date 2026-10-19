/**
 * The web client's names for the API's shapes. Every type comes from the shared zod schemas
 * (ADR-0003), so the client cannot drift from what the API sends.
 */
export type {
  AuditAction,
  AuditEntry,
  CreateEmployeeInput as EmployeeInput,
  DeleteStrategyName as DeleteStrategy,
  Employee,
  EmployeeRef,
  Role,
  Task,
  TaskStatus,
} from '@epiuse/shared';
