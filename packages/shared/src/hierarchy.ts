import { z } from 'zod';

/** One org chart node. The client lays the tree out itself (ADR-0005). */
export const HierarchyNodeSchema = z.object({
  id: z.uuid(),
  managerId: z.uuid().nullable(),
  employeeNumber: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  position: z.string(),
  avatarUrl: z.string().nullable(),
});
export type HierarchyNode = z.infer<typeof HierarchyNodeSchema>;

export const HierarchyResponseSchema = z.object({
  nodes: z.array(HierarchyNodeSchema),
  /** More than one root is a data-quality warning, not an error (ADR-0009). */
  rootCount: z.number().int(),
});
export type HierarchyResponse = z.infer<typeof HierarchyResponseSchema>;
