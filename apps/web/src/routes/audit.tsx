import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { useAudit } from '@/features/audit/api';
import { useIsAdmin } from '@/features/auth/use-session';
import { formatDateTime } from '@/features/employees/format';
import type { AuditAction } from '@/features/employees/types';
import { errorMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 50;

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
  if (!useIsAdmin()) {
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
  return <AuditTrail />;
}

function AuditTrail() {
  const [action, setAction] = useState<AuditAction | 'all'>('all');
  const [page, setPage] = useState(1);
  const audit = useAudit({
    action: action === 'all' ? undefined : action,
    page,
    pageSize: PAGE_SIZE,
  });
  const rows = audit.data?.items ?? [];
  const total = audit.data?.total ?? 0;

  return (
    <section className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit trail</h1>
          <p className="text-sm text-muted-foreground">
            Every change to an employee record, newest first. Entries cannot be edited.
          </p>
        </div>
        <Select
          value={action}
          onValueChange={(v) => {
            setAction(v as AuditAction | 'all');
            setPage(1);
          }}
        >
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

      {audit.isError && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(audit.error)}</AlertDescription>
        </Alert>
      )}

      <div
        className={cn(
          'min-h-0 flex-1 overflow-auto rounded-lg border transition-opacity',
          audit.isPlaceholderData && 'opacity-60',
        )}
      >
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
                  {entry.changedBy?.email ?? <span className="italic">System</span>}
                </TableCell>
              </TableRow>
            ))}
            {audit.isSuccess && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  No changes recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Newer changes"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Older changes"
            disabled={page * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}
    </section>
  );
}
