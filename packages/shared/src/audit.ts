import { z } from 'zod';
import { PageQuerySchema } from './pagination.js';

export const AuditActionSchema = z.enum(['CREATE', 'UPDATE', 'DELETE', 'REPARENT']);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditChangeSchema = z.object({
  field: z.string(),
  from: z.unknown(),
  to: z.unknown(),
});
export type AuditChange = z.infer<typeof AuditChangeSchema>;

export const AuditEntrySchema = z.object({
  id: z.number().int(),
  employeeId: z.uuid(),
  employeeName: z.string(),
  action: AuditActionSchema,
  /** `null` when the write did not come through the API, e.g. a seed script (ADR-0011). */
  changedBy: z.object({ id: z.uuid(), email: z.email() }).nullable(),
  changedAt: z.iso.datetime(),
  summary: z.string(),
  changes: z.array(AuditChangeSchema),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const AuditQuerySchema = PageQuerySchema.extend({
  employeeId: z.uuid().optional(),
  action: AuditActionSchema.optional(),
});
export type AuditQuery = z.infer<typeof AuditQuerySchema>;
