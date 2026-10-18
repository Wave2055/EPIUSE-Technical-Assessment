import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarIcon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { CreateEmployeeSchema } from '@epiuse/shared';
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
import { errorMessage, fieldIssues } from '@/lib/api-errors';
import { useHierarchy, useSaveEmployee } from './api';
import { formatDate, fullName, parseIsoDate, toIsoDate } from './format';
import { getEligibleManagers } from './hierarchy';
import type { Employee } from './types';

const NO_MANAGER = 'none';
const fields = CreateEmployeeSchema.shape;

/**
 * The shared create schema (ADR-0003), adapted to form inputs: salary is typed as text, a
 * date can be unpicked, and "no manager" is a sentinel the Select can hold.
 */
const employeeSchema = z.object({
  firstName: fields.firstName,
  lastName: fields.lastName,
  employeeNumber: fields.employeeNumber,
  email: fields.email,
  birthDate: z.string().min(1, 'Choose a birth date.').pipe(fields.birthDate),
  position: fields.position,
  salary: z
    .string()
    .trim()
    .min(1, 'Enter a salary.')
    .pipe(z.coerce.number('Enter the salary as a number.'))
    .pipe(fields.salary),
  managerId: z.string(),
});

/** The API names a clashing field by label (see the API's exception filter). */
const CONFLICT_FIELDS: Record<string, 'employeeNumber' | 'email'> = {
  'employee number': 'employeeNumber',
  'email address': 'email',
};

type FormValues = z.input<typeof employeeSchema>;

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
  const { data: chart } = useHierarchy();
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
      getEligibleManagers(chart?.nodes ?? [], employee?.id).sort((a, b) =>
        fullName(a).localeCompare(fullName(b)),
      ),
    [chart, employee?.id],
  );

  async function onSubmit(values: z.output<typeof employeeSchema>) {
    try {
      const saved = await save.mutateAsync({
        id: employee?.id,
        input: { ...values, managerId: values.managerId === NO_MANAGER ? null : values.managerId },
      });
      toast.success(employee ? `Saved ${fullName(saved)}` : `Added ${fullName(saved)}`);
      onOpenChange(false);
    } catch (error) {
      showServerError(error);
    }
  }

  /** Puts each server-side problem next to the field it belongs to, where possible. */
  function showServerError(error: unknown) {
    const issues = Object.entries(fieldIssues(error));
    if (issues.length > 0) {
      for (const [path, message] of issues) {
        if (path in employeeSchema.shape) {
          form.setError(path as keyof FormValues, { message });
        }
      }
      return;
    }
    if (error instanceof ApiRequestError && error.code === 'CONFLICT') {
      const labels = (error.details as { fields?: string[] } | undefined)?.fields ?? [];
      const field = labels.map((l) => CONFLICT_FIELDS[l]).find(Boolean);
      if (field) {
        form.setError(field, { message: error.message });
        return;
      }
    }
    form.setError('root', { message: errorMessage(error) });
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
                {employee ? 'Save changes' : 'Add employee'}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
