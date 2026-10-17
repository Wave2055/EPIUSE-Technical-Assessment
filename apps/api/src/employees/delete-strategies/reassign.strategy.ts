import { Injectable } from '@nestjs/common';
import { ApiError, HierarchyCycleError } from '../../common/errors/api-error.js';
import { HierarchyService } from '../../hierarchy/hierarchy.service.js';
import type { DeleteContext, DeleteStrategy } from './delete-strategy.js';

/** Reports move to a nominated employee — a hand-over. */
@Injectable()
export class ReassignStrategy implements DeleteStrategy {
  readonly name = 'reassign' as const;

  constructor(private readonly hierarchy: HierarchyService) {}

  async newManagerFor({ tx, target, reassignTo }: DeleteContext): Promise<string | null> {
    if (!reassignTo) {
      throw new ApiError(400, 'VALIDATION_FAILED', 'Choose who the direct reports move to.');
    }
    if (reassignTo === target.id) {
      throw new ApiError(
        422,
        'VALIDATION_FAILED',
        'Choose someone other than the person being deleted.',
      );
    }

    const chain = await this.hierarchy.ancestorChain(tx, reassignTo, target.id);
    if (chain.length === 0) {
      throw new ApiError(422, 'UNKNOWN_MANAGER', 'The chosen manager does not exist.');
    }
    // Someone inside the departing manager's own subtree cannot take over that subtree.
    if (chain.some((link) => link.id === target.id)) {
      throw new HierarchyCycleError(chain.map((l) => `${l.firstName} ${l.lastName}`));
    }
    return reassignTo;
  }
}
