/**
 * Shared package — the single source of validation truth for the API and the web client
 * (ADR-0003). Every request and response shape is a zod schema here; TypeScript types are
 * inferred from them, never declared twice.
 */
export * from './audit.js';
export * from './auth.js';
export * from './avatar.js';
export * from './employee.js';
export * from './employee-query.js';
export * from './errors.js';
export * from './hierarchy.js';
export * from './pagination.js';
export * from './task.js';
export * from './user.js';
