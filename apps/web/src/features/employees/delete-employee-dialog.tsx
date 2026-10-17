import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { deleteEmployee, MockRuleError, useEmployees } from '@/mocks/store';
import { fullName } from './format';
import { getDirectReports, getEligibleManagers } from './hierarchy';
import type { DeleteStrategy, Employee } from './types';

/**
 * Deleting a manager always asks where their reports go (ADR-0010). `promote` is the default,
 * except for a top-level employee, where it would scatter the team into new roots. Mount it
 * with `key={employee.id}` so the choice resets per employee.
 */
export function DeleteEmployeeDialog({
  employee,
  onOpenChange,
}: {
  employee: Employee;
  onOpenChange: (open: boolean) => void;
}) {
  const employees = useEmployees();
  const reports = useMemo(() => getDirectReports(employees, employee.id), [employees, employee]);
  const isRoot = employee.managerId === null;
  const manager = employees.find((e) => e.id === employee.managerId);
  const candidates = useMemo(
    () => getEligibleManagers(employees, employee.id),
    [employees, employee],
  );

  const [strategy, setStrategy] = useState<DeleteStrategy>(isRoot ? 'reassign' : 'promote');
  const [reassignTo, setReassignTo] = useState<string>('');

  const needsTarget = reports.length > 0 && strategy === 'reassign' && !reassignTo;
  const target = strategy === 'promote' ? manager : employees.find((e) => e.id === reassignTo);

  function confirm() {
    try {
      deleteEmployee(employee.id, strategy, reassignTo || undefined);
      toast.success(`Deleted ${fullName(employee)}`);
      onOpenChange(false);
    } catch (error) {
      if (error instanceof MockRuleError) toast.error(error.message);
      else throw error;
    }
  }

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {fullName(employee)}?</AlertDialogTitle>
          <AlertDialogDescription>
            {reports.length === 0
              ? 'Their record is removed. The change is kept in the audit trail.'
              : `${employee.firstName} has ${reports.length} direct report${reports.length === 1 ? '' : 's'}. Choose who they report to next.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {reports.length > 0 && (
          <div className="grid gap-4">
            <RadioGroup
              value={strategy}
              onValueChange={(v) => setStrategy(v as DeleteStrategy)}
              className="gap-3"
            >
              <Label
                htmlFor="strategy-promote"
                className="flex items-start gap-3 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-primary has-[[data-disabled]]:opacity-50"
              >
                <RadioGroupItem id="strategy-promote" value="promote" disabled={isRoot} />
                <span className="grid gap-0.5">
                  <span className="font-medium">Move them up a level</span>
                  <span className="text-muted-foreground">
                    {isRoot
                      ? `Not available: ${employee.firstName} has no manager to move them to.`
                      : `They will report to ${manager ? fullName(manager) : 'no one'}.`}
                  </span>
                </span>
              </Label>
              <Label
                htmlFor="strategy-reassign"
                className="flex items-start gap-3 rounded-md border p-3 font-normal has-[[data-state=checked]]:border-primary"
              >
                <RadioGroupItem id="strategy-reassign" value="reassign" />
                <span className="grid gap-0.5">
                  <span className="font-medium">Hand them over to someone else</span>
                  <span className="text-muted-foreground">Pick their new manager below.</span>
                </span>
              </Label>
            </RadioGroup>

            {strategy === 'reassign' && (
              <Select value={reassignTo} onValueChange={setReassignTo}>
                <SelectTrigger className="w-full" aria-label="New manager">
                  <SelectValue placeholder="Choose a new manager" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {fullName(c)} · {c.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="rounded-md bg-muted p-3 text-sm">
              <p className="mb-1 font-medium">Who moves</p>
              <ul className="grid gap-0.5 text-muted-foreground">
                {reports.map((r) => (
                  <li key={r.id}>
                    {fullName(r)} → {target ? fullName(target) : '…'}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button variant="destructive" disabled={needsTarget} onClick={confirm}>
            Delete employee
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
