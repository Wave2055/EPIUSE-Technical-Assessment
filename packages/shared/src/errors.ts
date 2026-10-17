import { z } from 'zod';

/**
 * Every non-2xx API response has this body. The web client's `ApiRequestError` reads the
 * same three fields, so the contract is enforced at both ends.
 */
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'SALARY_HIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'HIERARCHY_CYCLE',
  'UNKNOWN_MANAGER',
  'ROOT_DELETE_NEEDS_REASSIGN',
  'NOT_LINKED',
  'AVATAR_UPLOADS_DISABLED',
  'INTERNAL',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ApiErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string(),
  details: z.unknown().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

/** `details` for HIERARCHY_CYCLE: the chain of names that would loop, first and last equal. */
export const HierarchyCycleDetailsSchema = z.object({ path: z.array(z.string()) });
export type HierarchyCycleDetails = z.infer<typeof HierarchyCycleDetailsSchema>;
