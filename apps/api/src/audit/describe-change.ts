import type { AuditAction, AuditChange } from '@epiuse/shared';

/** The employee row as `to_jsonb` stored it in the audit trigger (snake_case columns). */
export type AuditSnapshot = Record<string, unknown>;

const IGNORED = new Set(['id', 'created_at', 'updated_at']);

const LABELS: Record<string, string> = {
  employee_number: 'employee number',
  first_name: 'first name',
  last_name: 'surname',
  email: 'email',
  birth_date: 'birth date',
  salary: 'salary',
  position: 'position',
  manager_id: 'manager',
  avatar_key: 'profile picture',
};

const FIELD_NAMES: Record<string, string> = {
  employee_number: 'employeeNumber',
  first_name: 'firstName',
  last_name: 'lastName',
  birth_date: 'birthDate',
  manager_id: 'managerId',
  avatar_key: 'avatarKey',
};

export function snapshotName(snapshot: AuditSnapshot | null): string | null {
  if (!snapshot) return null;
  return `${String(snapshot.first_name ?? '')} ${String(snapshot.last_name ?? '')}`.trim() || null;
}

/** Fields that differ between the before and after images, in camelCase. */
export function diffSnapshots(
  before: AuditSnapshot | null,
  after: AuditSnapshot | null,
): AuditChange[] {
  if (!before || !after) return [];
  return Object.keys(after)
    .filter(
      (key) => !IGNORED.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    )
    .map((key) => ({ field: FIELD_NAMES[key] ?? key, from: before[key], to: after[key] }));
}

/**
 * One readable line per audit row. `managerName` resolves a manager id to a name, or null
 * when that person has since been deleted.
 */
export function describeChange(
  action: AuditAction,
  before: AuditSnapshot | null,
  after: AuditSnapshot | null,
  managerName: (id: string) => string | null,
): string {
  const manager = (snapshot: AuditSnapshot | null) => {
    const id = snapshot?.manager_id;
    if (typeof id !== 'string') return null;
    return managerName(id) ?? 'a former employee';
  };

  switch (action) {
    case 'CREATE': {
      const m = manager(after);
      return m ? `Created, reporting to ${m}` : 'Created with no reporting manager';
    }
    case 'DELETE':
      return 'Deleted';
    case 'REPARENT': {
      const others = changedLabels(before, after).filter((l) => l !== 'manager');
      const move = `Manager changed from ${manager(before) ?? 'no one'} to ${manager(after) ?? 'no one'}`;
      return others.length > 0 ? `${move}; ${joinLabels(others)} also updated` : move;
    }
    case 'UPDATE': {
      const labels = changedLabels(before, after);
      if (labels.length === 0) return 'Updated';
      const text = joinLabels(labels);
      return `${text[0]!.toUpperCase()}${text.slice(1)} updated`;
    }
  }
}

function changedLabels(before: AuditSnapshot | null, after: AuditSnapshot | null): string[] {
  if (!before || !after) return [];
  return Object.keys(after)
    .filter(
      (key) => !IGNORED.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    )
    .map((key) => LABELS[key] ?? key);
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`;
}
