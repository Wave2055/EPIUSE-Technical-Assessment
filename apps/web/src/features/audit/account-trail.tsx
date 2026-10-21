import type { UserAuditAction, UserAuditEntry } from '@epiuse/shared';
import { useState, type ReactNode } from 'react';
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
import { cn } from '@/lib/utils';
import { useAccountTrail } from './api';

const LABELS: Record<UserAuditAction, string> = {
  CREATE: 'Login created',
  ROLE_CHANGE: 'Access changed',
  DEACTIVATE: 'Deactivated',
  REACTIVATE: 'Reactivated',
  PASSWORD_RESET: 'Password reset',
  PASSWORD_CHANGE: 'Password changed',
  DELETE: 'Login deleted',
};

const STYLES: Record<UserAuditAction, string> = {
  CREATE: 'border-transparent bg-primary text-primary-foreground',
  ROLE_CHANGE: 'border-primary/40 text-heading',
  DEACTIVATE: 'border-transparent bg-destructive text-white',
  REACTIVATE: 'border-border bg-secondary text-secondary-foreground',
  PASSWORD_RESET: 'border-warning/40 text-warning',
  PASSWORD_CHANGE: 'border-border bg-secondary text-secondary-foreground',
  DELETE: 'border-transparent bg-destructive text-white',
};

const role = (r: string | undefined) => (r === 'ADMIN' ? 'admin' : 'regular user');

function describe(entry: UserAuditEntry): string {
  switch (entry.action) {
    case 'CREATE':
      return `Created as ${role(entry.details?.role)}`;
    case 'ROLE_CHANGE':
      return `From ${role(entry.details?.from)} to ${role(entry.details?.to)}`;
    case 'DEACTIVATE':
      return 'Can no longer sign in';
    case 'REACTIVATE':
      return 'Can sign in again';
    case 'PASSWORD_RESET':
      return 'Issued a one-time password';
    case 'PASSWORD_CHANGE':
      return 'Chose a new password';
    case 'DELETE':
      return 'Removed with their employee record';
  }
}

/** Every change to a login, newest first, written by a database trigger (ADR-0036). */
export function AccountTrail({ switcher }: { switcher: ReactNode }) {
  const [action, setAction] = useState<UserAuditAction | 'all'>('all');
  const trail = useAccountTrail(action === 'all' ? undefined : action);
  const rows = trail.data?.pages.flatMap((page) => page.items) ?? [];
  const total = trail.data?.pages[0]?.total ?? 0;

  return (
    <section className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Audit trail</h1>
          <p className="text-sm text-muted-foreground">
            Every change to who can sign in and as what, newest first. Passwords are never recorded.
            {trail.isSuccess && ` Showing ${rows.length} of ${total}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {switcher}
          <Select value={action} onValueChange={(v) => setAction(v as UserAuditAction | 'all')}>
            <SelectTrigger className="w-48" aria-label="Filter by account change">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All account changes</SelectItem>
              {(Object.keys(LABELS) as UserAuditAction[]).map((a) => (
                <SelectItem key={a} value={a}>
                  {LABELS[a]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                <TableHead>Login</TableHead>
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
                    <Badge variant="outline" className={cn(STYLES[entry.action])}>
                      {LABELS[entry.action]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-heading">{entry.email}</TableCell>
                  <TableCell>{describe(entry)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {entry.changedBy?.email ?? <span className="italic">System</span>}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    No account changes of this kind yet.
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
