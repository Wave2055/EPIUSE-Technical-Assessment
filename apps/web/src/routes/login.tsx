import { LoginSchema, type LoginInput } from '@epiuse/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate, type Location } from 'react-router-dom';
import type { z } from 'zod';
import { Loading } from '@/components/loading';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { signIn, useSession } from '@/features/auth/session';
import { errorMessage } from '@/lib/errors';

/**
 * Login. Posts to the API, which returns a short-lived access token held in memory and sets
 * the refresh token as an httpOnly cookie (ADR-0014). Afterwards the user goes back to the
 * page that sent them here, or home.
 */
export function LoginRoute() {
  const session = useSession();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: Location } | null)?.from;
  const destination = from ? `${from.pathname}${from.search}${from.hash}` : '/';
  const form = useForm<z.input<typeof LoginSchema>, unknown, LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Wait for the stored session check, so a signed-in user is sent on rather than asked again.
  if (session.status === 'loading') return <Loading />;
  if (session.status === 'signedIn' && !form.formState.isSubmitting) {
    return <Navigate to={destination} replace />;
  }

  async function onSubmit(credentials: LoginInput) {
    try {
      await signIn(credentials);
      void navigate(destination, { replace: true });
    } catch (error) {
      form.setError('root', { message: errorMessage(error) });
    }
  }

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
            <CardTitle className="text-xl text-heading">Sign in</CardTitle>
            <CardDescription>Use the account your administrator set up for you.</CardDescription>
          </CardHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
              <CardContent className="grid gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="username" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="current-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {form.formState.errors.root && (
                  <p role="alert" className="text-sm text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                )}
              </CardContent>
              <CardFooter className="mt-6">
                <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? 'Signing in…' : 'Sign in'}
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
