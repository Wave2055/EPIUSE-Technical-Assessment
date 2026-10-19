import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type Column,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Loading } from '@/components/loading';
import { QueryError } from '@/components/query-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEmployeesQuery } from '@/features/employees/api';
import { DeleteEmployeeDialog } from '@/features/employees/delete-employee-dialog';
import { EmployeeAvatar } from '@/features/employees/employee-avatar';
import { EmployeeFormSheet } from '@/features/employees/employee-form-sheet';
import { formatDate, formatSalary, fullName } from '@/features/employees/format';
import type { Employee } from '@/features/employees/types';
import { useIsAdmin } from '@/features/auth/session';
import { cn } from '@/lib/utils';

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
  filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
  columnMeta: {} as { align?: 'left' | 'right' },
});

type Row = Employee & { name: string; managerName: string };

const ALL = 'all';
const col = createColumnHelper<typeof features, Row>();

/**
 * The reporting table: the brief's second required surface, sortable and filterable on any
 * employee field.
 *
 * TanStack Table supplies per-column sort and filter (ADR-0005). Sorting and filtering on
 * salary is refused for a VIEWER, because permitting it would leak the ordering of a field
 * the API has masked (ADR-0014).
 */
export function EmployeesRoute() {
  const employeesQuery = useEmployeesQuery();
  if (employeesQuery.isPending) return <Loading />;
  if (employeesQuery.isError) {
    return (
      <QueryError error={employeesQuery.error} onRetry={() => void employeesQuery.refetch()} />
    );
  }
  return <EmployeesTable employees={employeesQuery.data} />;
}

function EmployeesTable({ employees }: { employees: Employee[] }) {
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const data = useMemo<Row[]>(
    () =>
      employees.map((e) => ({
        ...e,
        name: fullName(e),
        managerName: e.manager ? fullName(e.manager) : '',
      })),
    [employees],
  );

  const positions = useMemo(
    () => [...new Set(employees.map((e) => e.position))].sort(),
    [employees],
  );
  const managers = useMemo(
    () => [...new Set(data.map((r) => r.managerName).filter(Boolean))].sort(),
    [data],
  );

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor('name', {
          header: 'Name',
          sortFn: 'text',
          cell: ({ row }) => (
            <div className="flex items-center gap-3">
              <EmployeeAvatar employee={row.original} />
              <div className="grid">
                <span className="font-medium text-heading">{row.original.name}</span>
                <span className="text-xs text-muted-foreground">{row.original.email}</span>
              </div>
            </div>
          ),
        }),
        col.accessor('employeeNumber', {
          header: 'Number',
          sortFn: 'alphanumeric',
          cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
        }),
        col.accessor('position', { header: 'Role', sortFn: 'text', filterFn: 'equalsString' }),
        col.accessor('managerName', {
          header: 'Manager',
          sortFn: 'text',
          filterFn: 'equalsString',
          cell: (info) =>
            info.getValue() || (
              <Badge variant="outline" className="border-warning/40 text-warning">
                No manager
              </Badge>
            ),
        }),
        col.accessor('birthDate', {
          header: 'Birth date',
          sortFn: 'alphanumeric',
          cell: (info) => formatDate(info.getValue()),
        }),
        col.accessor('salary', {
          header: 'Salary',
          sortFn: 'basic',
          enableSorting: isAdmin,
          enableGlobalFilter: false,
          meta: { align: 'right' },
          cell: (info) => (
            <span
              className={cn('tabular-nums', info.getValue() === null && 'text-muted-foreground')}
            >
              {formatSalary(info.getValue())}
            </span>
          ),
        }),
        col.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) =>
            isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Actions for ${row.original.name}`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setEditing(row.original)}>
                    <Pencil /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeleting(row.original)}
                  >
                    <Trash2 /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ),
        }),
      ]),
    [isAdmin],
  );

  const table = useTable({
    features,
    columns,
    data,
    globalFilterFn: 'includesString',
    initialState: { sorting: [{ id: 'name', desc: false }] },
  });

  const globalFilter = (table.state.globalFilter as string | undefined) ?? '';
  const positionFilter = (table.getColumn('position')?.getFilterValue() as string) ?? ALL;
  const managerFilter = (table.getColumn('managerName')?.getFilterValue() as string) ?? ALL;
  const filtered = globalFilter !== '' || positionFilter !== ALL || managerFilter !== ALL;
  const rows = table.getRowModel().rows;

  return (
    <section className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length === data.length
              ? `${data.length} employees`
              : `${rows.length} of ${data.length} employees`}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setEditing(null)}>
            <Plus /> Add employee
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
            placeholder="Search name, number, email or role"
            className="pl-8"
            aria-label="Search employees"
          />
        </div>
        <Select
          value={positionFilter}
          onValueChange={(v) =>
            table.getColumn('position')?.setFilterValue(v === ALL ? undefined : v)
          }
        >
          <SelectTrigger className="w-48" aria-label="Filter by role">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
            {positions.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={managerFilter}
          onValueChange={(v) =>
            table.getColumn('managerName')?.setFilterValue(v === ALL ? undefined : v)
          }
        >
          <SelectTrigger className="w-48" aria-label="Filter by manager">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All managers</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              table.setGlobalFilter('');
              table.resetColumnFilters();
            }}
          >
            <X /> Clear
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-lg border">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-secondary">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(header.column.columnDef.meta?.align === 'right' && 'text-right')}
                  >
                    {header.column.getCanSort() ? (
                      <SortButton column={header.column}>
                        <table.FlexRender header={header} />
                      </SortButton>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(cell.column.columnDef.meta?.align === 'right' && 'text-right')}
                  >
                    <table.FlexRender cell={cell} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  No employees match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {editing !== undefined && (
        <EmployeeFormSheet
          open
          onOpenChange={(open) => !open && setEditing(undefined)}
          employee={editing}
        />
      )}
      {deleting && (
        <DeleteEmployeeDialog
          key={deleting.id}
          employee={deleting}
          onOpenChange={(open) => !open && setDeleting(null)}
        />
      )}
    </section>
  );
}

function SortButton({
  column,
  children,
}: {
  column: Column<typeof features, Row>;
  children: React.ReactNode;
}) {
  const sorted = column.getIsSorted();
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={cn(
        '-ml-2 inline-flex items-center gap-1 rounded px-2 py-1 hover:bg-accent',
        column.columnDef.meta?.align === 'right' && 'ml-auto -mr-2',
      )}
    >
      {children}
      <Icon className={cn('size-3.5', !sorted && 'opacity-40')} />
    </button>
  );
}
