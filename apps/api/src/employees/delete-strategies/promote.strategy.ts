import { Injectable } from '@nestjs/common';
import { ApiError } from '../../common/errors/api-error.js';
import type { DeleteContext, DeleteStrategy } from './delete-strategy.js';

/** Reports move up to the deleted employee's own manager — a team moving up a level. */
@Injectable()
export class PromoteStrategy implements DeleteStrategy {
  readonly name = 'promote' as const;

  newManagerFor({ target }: DeleteContext): Promise<string | null> {
    // Promoting under a root would turn every report into a new root.
    if (target.managerId === null) {
      throw new ApiError(
        422,
        'ROOT_DELETE_NEEDS_REASSIGN',
        `${target.firstName} ${target.lastName} has no manager to move their team to. Choose who they report to instead.`,
      );
    }
    return Promise.resolve(target.managerId);
  }
}
