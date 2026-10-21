import { useLocation, useNavigate, type Location } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChangePasswordForm } from '@/features/auth/change-password-form';
import { signOut, useCurrentUser } from '@/features/auth/session';

/**
 * Shown straight after signing in with a one-time password (ADR-0036): nothing else works
 * until it is replaced. Laid out like the sign-in page, outside the app shell.
 */
export function ChangePasswordRoute() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: Location } | null)?.from;
  const destination = from ? `${from.pathname}${from.search}${from.hash}` : '/';

  return (
    <div className="flex h-full flex-col">
      <div className="h-2 bg-header" />
      <div className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-heading">
              <span aria-hidden className="size-2.5 rounded-full bg-brand" />
              Employee Hierarchy
            </div>
            <CardTitle className="text-xl text-heading">Choose your password</CardTitle>
            <CardDescription>
              {user.mustChangePassword
                ? `You signed in as ${user.email} with a one-time password. Choose your own to continue.`
                : 'Change the password you sign in with.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ChangePasswordForm
              currentLabel={user.mustChangePassword ? 'One-time password' : 'Current password'}
              submitLabel="Save and continue"
              onDone={() => {
                toast.success('Your password has been changed.');
                void navigate(destination === '/change-password' ? '/' : destination, {
                  replace: true,
                });
              }}
            />
            <Button variant="ghost" onClick={() => void signOut()}>
              Sign out instead
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
