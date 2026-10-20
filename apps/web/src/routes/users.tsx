import type { UserStatus, UserSummary } from '@epiuse/shared';
import {
  KeyRound,
  Lock,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Loading } from '@/components/loading';
import { QueryError } from '@/components/query-error';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useCurrentUser, useIsAdmin } from '@/features/auth/session';
import { EmployeeAvatar } from '@/features/employees/employee-avatar';
import { formatDateTime, fullName } from '@/features/employees/format';
import { useResetPassword, useUpdateUser, useUsers } from '@/features/users/api';
import { showOneTimePassword } from '@/features/users/one-time-password-store';
import { errorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';

const STATUS: Record<UserStatus, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'border-transparent bg-secondary text-secondary-foreground',
  },
  must_change_password: {
    label: 'Has a one-time password',
    className: 'border-warning/40 text-warning',
  },
  no_password: { label: 'No password yet', className: 'border-warning/40 text-warning' },
  deactivated: {
    label: 'Deactivated',
    className: 'border-destructive/40 text-destructive',
  },
};

type Action = 'promote' | 'demote' | 'deactivate' | 'reactivate' | 'reset';

const CONFIRM: Record<
  Action,
  { title: (n: string) => string; body: (n: string) => string; button: string; danger?: boolean }
> = {
  promote: {
    title: (n) => `Make ${n} an admin?`,
    body: (n) =>
      `${n} will be able to add, edit and delete employees, see salaries and the audit trail, and manage everyone's access, including yours. It takes effect straight away.`,
    button: 'Make admin',
  },
  demote: {
    title: (n) => `Make ${n} a regular user?`,
    body: (n) =>
      `${n} will lose admin access straight away and be signed out. They can sign in again as a regular user.`,
    button: 'Make regular user',
    danger: true,
  },
  deactivate: {
    title: (n) => `Deactivate ${n}'s login?`,
    body: (n) =>
      `${n} will be signed out straight away and won't be able to sign in. Their employee record and history stay as they are. You can reactivate the login later.`,
    button: 'Deactivate',
    danger: true,
  },
  reactivate: {
    title: (n) => `Reactivate ${n}'s login?`,
    body: (n) => `${n} will be able to sign in again with their existing password.`,
    button: 'Reactivate',
  },
  reset: {
    title: (n) => `Issue ${n} a new one-time password?`,
    body: (n) =>
      `${n}'s current password will stop working and they'll be signed out. You'll see the new password once; they'll choose their own when they sign in.`,
    button: 'Issue password',
  },
};

/**
 * Who can sign in, and as what (ADR-0036). Logins are created with employees, so there is
 * no "add" here; admins issue passwords, change roles and deactivate. Admin-only, and an
 * admin cannot change their own access.
 */
export function UsersRoute() {
  const isAdmin = useIsAdmin();
  if (!isAdmin) {
    return (
      <section className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <Lock className="size-6 text-muted-foreground" />
        <h1 className="text-lg font-semibold">Managing users is for admins</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ask an administrator if you need someone&apos;s access changed.
        </p>
      </section>
    );
  }
  return <UsersTable />;
}

function UsersTable() {
  const me = useCurrentUser();
  const users = useUsers();
  const update = useUpdateUser();
  const reset = useResetPassword();
  const [pending, setPending] = useState<{ action: Action; user: UserSummary } | null>(null);

  if (users.isPending) return <Loading />;
  if (users.isError) {
    return <QueryError error={users.error} onRetry={() => void users.refetch()} />;
  }
  const rows = users.data.users;
  const admins = rows.filter((u) => u.role === 'ADMIN' && u.status !== 'deactivated').length;

  async function confirm() {
    if (!pending) return;
    const { action, user } = pending;
    const name = fullName(user.employee);
    try {
      if (action === 'reset') {
        const issued = await reset.mutateAsync(user.id);
        showOneTimePassword({ ...issued, name, reason: 'reset' });
      } else {
        const changes = {
          promote: { role: 'ADMIN' as const },
          demote: { role: 'VIEWER' as const },
          deactivate: { active: false },
          reactivate: { active: true },
        }[action];
        await update.mutateAsync({ id: user.id, changes });
        toast.success(
          {
            promote: `${name} is now an admin`,
            demote: `${name} is now a regular user`,
            deactivate: `Deactivated ${name}'s login`,
            reactivate: `Reactivated ${name}'s login`,
          }[action],
        );
      }
      setPending(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <section className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} logins, {admins} {admins === 1 ? 'admin' : 'admins'}. Every employee has
          one; add an employee to create a login.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-secondary">
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((user) => {
              const name = fullName(user.employee);
              const isMe = user.id === me.id;
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar employee={user.employee} />
                      <div className="grid">
                        <span className="font-medium text-heading">
                          {name}
                          {isMe && (
                            <Badge variant="outline" className="ml-2 text-[11px]">
                              You
                            </Badge>
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground">{user.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {user.employee.employeeNumber}
                  </TableCell>
                  <TableCell>
                    {user.role === 'ADMIN' ? (
                      <Badge className="gap-1">
                        <ShieldCheck className="size-3" /> Admin
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">Regular user</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn(STATUS[user.status].className)}>
                      {STATUS[user.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Access for ${name}`}
                          disabled={isMe}
                          title={isMe ? "You can't change your own access" : undefined}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {user.role === 'VIEWER' ? (
                          <DropdownMenuItem
                            onSelect={() => setPending({ action: 'promote', user })}
                          >
                            <ShieldCheck /> Make admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onSelect={() => setPending({ action: 'demote', user })}>
                            <ShieldOff /> Make regular user
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setPending({ action: 'reset', user })}>
                          <KeyRound />
                          {user.status === 'no_password' ? 'Issue a password' : 'Reset password'}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {user.status === 'deactivated' ? (
                          <DropdownMenuItem
                            onSelect={() => setPending({ action: 'reactivate', user })}
                          >
                            <UserCheck /> Reactivate
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setPending({ action: 'deactivate', user })}
                          >
                            <UserX /> Deactivate
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        {pending && (
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {CONFIRM[pending.action].title(fullName(pending.user.employee))}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {CONFIRM[pending.action].body(pending.user.employee.firstName)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button
                variant={CONFIRM[pending.action].danger ? 'destructive' : 'default'}
                disabled={update.isPending || reset.isPending}
                onClick={() => void confirm()}
              >
                {CONFIRM[pending.action].button}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </section>
  );
}
