import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { EmployeeAvatar } from '@/features/employees/employee-avatar';
import { fullName } from '@/features/employees/format';
import type { Employee } from '@/features/employees/types';

/** Find-a-person for the org chart. Ctrl/⌘ K opens it from anywhere on the page. */
export function EmployeeSearch({
  employees,
  onSelect,
}: {
  employees: Employee[];
  onSelect: (employee: Employee) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        className="w-64 justify-start text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Search />
        Find an employee
        <kbd className="ml-auto rounded border bg-muted px-1.5 font-mono text-[10px]">Ctrl K</kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Find an employee"
        description="Search by name, role or employee number"
      >
        <CommandInput placeholder="Name, role or employee number" />
        <CommandList>
          <CommandEmpty>No employee matches that search.</CommandEmpty>
          <CommandGroup heading="Employees">
            {employees.map((e) => (
              <CommandItem
                key={e.id}
                value={`${fullName(e)} ${e.position} ${e.employeeNumber}`}
                onSelect={() => {
                  setOpen(false);
                  onSelect(e);
                }}
              >
                <EmployeeAvatar employee={e} className="size-6" />
                <span className="font-medium">{fullName(e)}</span>
                <span className="truncate text-muted-foreground">{e.position}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {e.employeeNumber}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
