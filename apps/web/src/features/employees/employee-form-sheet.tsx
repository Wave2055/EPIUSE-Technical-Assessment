import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ApiRequestError } from '@/lib/api-client';
import { errorMessage } from '@/lib/errors';
import { useEmployees, useSaveEmployee } from './api';
import { formatDate, fullName, parseIsoDate, toIsoDate } from './format';
import { getEligibleManagers } from './hierarchy';
import type { Employee } from './types';
import { showOneTimePassword } from '@/features/users/one-time-password-store';

const NO_MANAGER = 'none';

/**
 * The form's own shape: text inputs and a select, converted on submit. The API validates
 * again with the shared CreateEmployeeSchema and its messages land on the same fields.
 */
const employeeSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter a first name.'),
  lastName: z.string().trim().min(1, 'Enter a surname.'),
  employeeNumber: z
    .string()
    .trim()
    .regex(/^E-\d{4}$/, 'Use the format E-0000.'),
  email: z.email('Enter a valid email address.'),
  birthDate: z.string().min(1, 'Choose a birth date.'),
  position: z.string().trim().min(1, 'Enter a role or position.'),
  salary: z.coerce.number<string>().nonnegative('Salary cannot be negative.'),
  managerId: z.string(),
});

type FormValues = z.input<typeof employeeSchema>;
const FIELDS = Object.keys(employeeSchema.shape) as (keyof FormValues)[];

const emptyValues: FormValues = {
  firstName: '',
  lastName: '',
  employeeNumber: '',
  email: '',
  birthDate: '',
  position: '',
  salary: '',
  managerId: NO_MANAGER,
};

function toFormValues(employee: Employee | null, defaultManagerId?: string): FormValues {
  if (!employee) return { ...emptyValues, managerId: defaultManagerId ?? NO_MANAGER };
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    employeeNumber: employee.employeeNumber,
    email: employee.email,
    birthDate: employee.birthDate,
    position: employee.position,
    salary: employee.salary === null ? '' : String(employee.salary),
    managerId: employee.managerId ?? NO_MANAGER,
  };
}

/** Create and edit share one panel. `employee: null` means create. */
export function EmployeeFormSheet({
  open,
  onOpenChange,
  employee,
  defaultManagerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  defaultManagerId?: string;
}) {
  const employees = useEmployees();
  const save = useSaveEmployee();
  const form = useForm<FormValues, unknown, z.output<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: toFormValues(employee, defaultManagerId),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(employee, defaultManagerId));
  }, [open, employee, defaultManagerId, form]);

  const managers = useMemo(
    () =>
      getEligibleManagers(employees, employee?.id).sort((a, b) =>
        fullName(a).localeCompare(fullName(b)),
      ),
    [employees, employee?.id],
  );

  async function onSubmit(values: z.output<typeof employeeSchema>) {
    try {
      const { employee: saved, login } = await save.mutateAsync({
        id: employee?.id,
        input: { ...values, managerId: values.managerId === NO_MANAGER ? null : values.managerId },
      });
      toast.success(employee ? `Saved ${fullName(saved)}` : `Added ${fullName(saved)}`);
      onOpenChange(false);
      // Every new employee gets a login (ADR-0036): show its one-time password, once.
      if (login) showOneTimePassword({ ...login, name: fullName(saved), reason: 'created' });
    } catch (error) {
      showApiError(error);
    }
  }

  /**
   * Field-level validation goes beside its field; anything else (a duplicate number or
   * email, a reporting loop the picker could not foresee) goes under the form.
   */
  function showApiError(error: unknown) {
    const issues =
      error instanceof ApiRequestError && error.code === 'VALIDATION_FAILED'
        ? ((error.details as { issues?: { path: string; message: string }[] } | undefined)
            ?.issues ?? [])
        : [];
    const fieldIssues = issues.filter((i) => FIELDS.includes(i.path as keyof FormValues));
    for (const issue of fieldIssues) {
      form.setError(issue.path as keyof FormValues, { message: issue.message });
    }
    if (fieldIssues.length === 0 || fieldIssues.length < issues.length) {
      form.setError('root', { message: errorMessage(error) });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        <SheetHeader className="border-b">
          <SheetTitle>{employee ? `Edit ${fullName(employee)}` : 'Add employee'}</SheetTitle>
          <SheetDescription>
            {employee
              ? 'Changes are saved to the employee record and logged in the audit trail.'
              : 'The new employee appears in the org chart under their manager.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
            noValidate
          >
            <div className="grid flex-1 content-start gap-4 overflow-y-auto p-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surname</FormLabel>
                    <FormControl>
                      <Input autoComplete="off" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="employeeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee number</FormLabel>
                    <FormControl>
                      <Input placeholder="E-0000" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="birthDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birth date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className="justify-between font-normal data-[empty=true]:text-muted-foreground"
                            data-empty={!field.value}
                          >
                            {field.value ? formatDate(field.value) : 'Choose a date'}
                            <CalendarIcon className="opacity-60" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          captionLayout="dropdown"
                          selected={field.value ? parseIsoDate(field.value) : undefined}
                          defaultMonth={field.value ? parseIsoDate(field.value) : new Date(1990, 0)}
                          startMonth={new Date(1940, 0)}
                          endMonth={new Date()}
                          disabled={{ after: new Date() }}
                          onSelect={(date) => field.onChange(date ? toIsoDate(date) : '')}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="off" {...field} />
                    </FormControl>
                    <FormDescription>
                      Used to show the employee&apos;s Gravatar picture.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role / position</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Annual salary (ZAR)</FormLabel>
                    <FormControl>
                      <Input inputMode="numeric" className="tabular-nums" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="managerId"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Reporting line manager</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_MANAGER}>
                          No manager (top of the hierarchy)
                        </SelectItem>
                        {managers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {fullName(m)} · {m.position}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {employee && (
                      <FormDescription>
                        People who report to {employee.firstName} are left out, so the hierarchy
                        cannot loop back on itself.
                      </FormDescription>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p role="alert" className="text-sm text-destructive sm:col-span-2">
                  {form.formState.errors.root.message}
                </p>
              )}
            </div>

            <SheetFooter className="flex-row justify-end border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? 'Saving…'
                  : employee
                    ? 'Save changes'
                    : 'Add employee'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
