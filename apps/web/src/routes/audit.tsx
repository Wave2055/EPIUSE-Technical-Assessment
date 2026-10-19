import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Loading } from '@/components/loading';
import { QueryError } from '@/components/query-error';
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
import { formatDateTime } from '@/features/employees/format';
import type { AuditAction } from '@/features/employees/types';
import { cn } from '@/lib/utils';
import { useAuditTrail } from '@/features/audit/api';
import { useIsAdmin } from '@/features/auth/session';

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
 * by construction (ADR-0011). The API filters by change type and pages the results.
 */
export function AuditRoute() {
  const isAdmin = useIsAdmin();
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
  return <AuditTrail />;
}

function AuditTrail() {
  const [action, setAction] = useState<AuditAction | 'all'>('all');
  const trail = useAuditTrail(action === 'all' ? undefined : action);
  const rows = trail.data?.pages.flatMap((page) => page.items) ?? [];
  const total = trail.data?.pages[0]?.total ?? 0;

  return (
    <section className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit trail</h1>
          <p className="text-sm text-muted-foreground">
            Every change to an employee record, newest first. Entries cannot be edited.
            {trail.isSuccess && ` Showing ${rows.length} of ${total}.`}
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

      {trail.isPending && <Loading />}
      {trail.isError && <QueryError error={trail.error} onRetry={() => void trail.refetch()} />}
      {trail.isSuccess && (
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
                    {entry.changedBy?.email ?? <span className="italic">System</span>}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No changes of this kind yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {trail.hasNextPage && (
            <div className="flex justify-center border-t p-3">
              <Button
                variant="outline"
                size="sm"
                disabled={trail.isFetchingNextPage}
                onClick={() => void trail.fetchNextPage()}
              >
                {trail.isFetchingNextPage ? 'Loading…' : 'Show older changes'}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
