import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
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

const loginSchema = z.object({
  email: z.email('Enter the email address you sign in with.'),
  password: z.string().min(1, 'Enter your password.'),
});

/**
 * Login. Posts to the API, which returns a short-lived access token held in memory and sets
 * the refresh token as an httpOnly cookie (ADR-0014).
 *
 * Until the auth endpoints exist, any well-formed credentials go straight through.
 */
export function LoginRoute() {
  const navigate = useNavigate();
  const form = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

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
            <form onSubmit={form.handleSubmit(() => navigate('/hierarchy'))} noValidate>
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
              <CardFooter className="mt-6">
                <Button type="submit" className="w-full">
                  Sign in
                </Button>
              </CardFooter>
            </form>
          </Form>
        </Card>
      </div>
    </div>
  );
}
