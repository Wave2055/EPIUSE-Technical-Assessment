import { NewPasswordSchema } from '@epiuse/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ApiRequestError } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';
import { changePassword } from './session';

/** The shared rules (ADR-0003), plus a confirmation that only the form needs. */
const formSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: NewPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: 'Choose a password different from your current one.',
    path: ['newPassword'],
  })
  .refine((v) => v.confirmPassword === v.newPassword, {
    message: 'The two passwords do not match.',
    path: ['confirmPassword'],
  });
type FormValues = z.infer<typeof formSchema>;

/**
 * Change the signed-in user's password (ADR-0036). Used on its own page after signing in
 * with a one-time password, and in a dialog from the account menu.
 */
export function ChangePasswordForm({
  currentLabel = 'Current password',
  submitLabel = 'Change password',
  onDone,
}: {
  currentLabel?: string;
  submitLabel?: string;
  onDone: () => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  async function onSubmit({ currentPassword, newPassword }: FormValues) {
    try {
      await changePassword({ currentPassword, newPassword });
      onDone();
    } catch (error) {
      const field =
        error instanceof ApiRequestError && error.code === 'VALIDATION_FAILED'
          ? (error.details as { issues?: { path: string }[] } | undefined)?.issues?.[0]?.path
          : undefined;
      if (field === 'currentPassword' || field === 'newPassword') {
        form.setError(field, { message: errorMessage(error) });
      } else {
        form.setError('root', { message: errorMessage(error) });
      }
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="grid gap-4">
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{currentLabel}</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="newPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
              </FormControl>
              <FormDescription>At least 12 characters. A short phrase works well.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm new password</FormLabel>
              <FormControl>
                <Input type="password" autoComplete="new-password" {...field} />
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
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </form>
    </Form>
  );
}
