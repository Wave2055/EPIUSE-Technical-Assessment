import type { DeleteStrategyName } from '@epiuse/shared';
import type { Tx } from '../../prisma/prisma.service.js';

export interface DeleteTarget {
  id: string;
  firstName: string;
  lastName: string;
  managerId: string | null;
}

export interface DeleteContext {
  tx: Tx;
  target: DeleteTarget;
  reassignTo?: string;
}

/**
 * Where a deleted manager's direct reports go (ADR-0010, Strategy pattern). Each strategy
 * only decides the new manager; the service moves the reports and deletes the employee in
 * one transaction.
 */
export interface DeleteStrategy {
  readonly name: DeleteStrategyName;
  newManagerFor(context: DeleteContext): Promise<string | null>;
}
