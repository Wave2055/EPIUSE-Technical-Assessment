import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginInput } from '@epiuse/shared';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import type { z } from 'zod';
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
import { useSession } from '@/features/auth/use-session';
import { errorMessage } from '@/lib/api-errors';

/**
 * Login. Posts to the API, which returns a short-lived access token held in memory and sets
 * the refresh token as an httpOnly cookie (ADR-0014).
 *
 * After signing in, the user returns to the page they were sent here from.
 */
export function LoginRoute() {
  const { state, login } = useSession();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const form = useForm<z.input<typeof LoginSchema>, unknown, LoginInput>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { email: '', password: '' },
  });

  if (state.status === 'signedIn') return <Navigate to={from} replace />;

  async function onSubmit(values: LoginInput) {
    try {
      await login(values);
      navigate(from, { replace: true });
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
              </CardContent>
              {form.formState.errors.root && (
                <p role="alert" className="mt-4 px-6 text-sm text-destructive">
                  {form.formState.errors.root.message}
                </p>
              )}
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
