import { Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateTime } from '@/features/employees/format';
import type { AuditAction } from '@/features/employees/types';
import { cn } from '@/lib/utils';
import { useIsAdmin } from '@/features/auth/session';
import { useAudit } from '@/mocks/store';

const ACTION_STYLES: Record<AuditAction, string> = {
  CREATE: 'border-transparent bg-primary text-primary-foreground',
  UPDATE: 'border-border bg-secondary text-secondary-foreground',
  REPARENT: 'border-primary/40 text-heading',
  DELETE: 'border-transparent bg-destructive text-white',
};

const ACTION_LABELS: Record<AuditAction, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  REPARENT: 'Manager changed',
  DELETE: 'Deleted',
};

/**
 * Audit trail, ADMIN only. Rows are written by database triggers, so this view is read-only
 * by construction (ADR-0011).
 */
export function AuditRoute() {
  const entries = useAudit();
  const isAdmin = useIsAdmin();
  const [action, setAction] = useState<AuditAction | 'all'>('all');
  const rows = useMemo(
    () => (action === 'all' ? entries : entries.filter((e) => e.action === action)),
    [entries, action],
  );

  if (!isAdmin) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Lock className="size-6 text-muted-foreground" />
        <h1 className="text-lg font-semibold">The audit trail is for admins</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ask an administrator if you need to know who changed an employee record.
        </p>
      </section>
    );
  }

  return (
    <section className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit trail</h1>
          <p className="text-sm text-muted-foreground">
            Every change to an employee record, newest first. Entries cannot be edited.
          </p>
        </div>
        <Select value={action} onValueChange={(v) => setAction(v as AuditAction | 'all')}>
          <SelectTrigger className="w-48" aria-label="Filter by change type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All changes</SelectItem>
            {(Object.keys(ACTION_LABELS) as AuditAction[]).map((a) => (
              <SelectItem key={a} value={a}>
                {ACTION_LABELS[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 bg-secondary">
            <TableRow className="hover:bg-transparent">
              <TableHead>When</TableHead>
              <TableHead>Change</TableHead>
              <TableHead>Employee</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Changed by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground tabular-nums">
                  {formatDateTime(entry.changedAt)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={cn(ACTION_STYLES[entry.action])}>
                    {ACTION_LABELS[entry.action]}
                  </Badge>
                </TableCell>
                <TableCell className="font-medium text-heading">{entry.employeeName}</TableCell>
                <TableCell className="whitespace-normal">{entry.summary}</TableCell>
                <TableCell className="text-muted-foreground">
                  {entry.changedBy ?? <span className="italic">System</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
