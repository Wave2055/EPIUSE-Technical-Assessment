import {
  columnFilteringFeature,
  columnVisibilityFeature,
  constructFilterFn,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_inDateRange,
  filterFn_inNumberRange,
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
  Banknote,
  CalendarRange,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
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
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

/**
 * The search box's match: every word must appear somewhere in the row, so "aisha manager"
 * finds Aisha Patel, Engineering Manager, as the API's own search does.
 */
const filterFn_allWords = constructFilterFn({
  filter: (dataValue: string | undefined, words: string[]) =>
    words.every((word) => dataValue?.includes(word)),
  autoRemove: (value) => String(value ?? '').trim() === '',
  resolveFilterValue: (value) => String(value).toLowerCase().split(/\s+/).filter(Boolean),
  resolveDataValue: (value) =>
    value === null || value === undefined ? undefined : String(value).toLowerCase(),
});

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  columnVisibilityFeature,
  globalFilteringFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  sortFns: { alphanumeric: sortFn_alphanumeric, text: sortFn_text, basic: sortFn_basic },
  filterFns: {
    includesString: filterFn_includesString,
    allWords: filterFn_allWords,
    equalsString: filterFn_equalsString,
    inDateRange: filterFn_inDateRange,
    inNumberRange: filterFn_inNumberRange,
  },
  columnMeta: {} as { align?: 'left' | 'right' },
});

type Row = Employee & { name: string; managerName: string; search: string };

/**
 * Columns that exist only to be sorted, filtered or searched on. The Name column shows
 * first name, surname and email together, so each needs its own column behind it.
 */
const HIDDEN = { firstName: false, lastName: false, email: false, search: false };

/** A range filter's value: `[from, to]` as typed, either end blank for open-ended. */
type Range = [string, string];

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

export function EmployeesTable({ employees }: { employees: Employee[] }) {
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const data = useMemo<Row[]>(
    () =>
      employees.map((e) => ({
        ...e,
        name: fullName(e),
        managerName: e.manager ? fullName(e.manager) : '',
        search: [fullName(e), e.employeeNumber, e.email, e.position].join(' '),
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
          // Sorted through the hidden columns, so either first name or surname can lead.
          header: ({ table }) => (
            <span className="inline-flex items-center gap-1">
              <SortButton column={table.getColumn('firstName')!}>First name</SortButton>
              <SortButton column={table.getColumn('lastName')!}>Surname</SortButton>
            </span>
          ),
          enableSorting: false,
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
        col.accessor('firstName', { sortFn: 'text', filterFn: 'includesString' }),
        col.accessor('lastName', { sortFn: 'text', filterFn: 'includesString' }),
        col.accessor('email', { filterFn: 'includesString' }),
        col.accessor('search', { filterFn: 'allWords' }),
        col.accessor('employeeNumber', {
          header: 'Number',
          sortFn: 'alphanumeric',
          filterFn: 'includesString',
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
          filterFn: 'inDateRange',
          cell: (info) => formatDate(info.getValue()),
        }),
        col.accessor('salary', {
          header: 'Salary',
          sortFn: 'basic',
          enableSorting: isAdmin,
          enableColumnFilter: isAdmin,
          filterFn: 'inNumberRange',
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
    // Only the search column takes part, so one word cannot match a salary or a date.
    globalFilterFn: 'allWords',
    getColumnCanGlobalFilter: (column) => column.id === 'search',
    initialState: { sorting: [{ id: 'firstName', desc: false }], columnVisibility: HIDDEN },
  });

  const globalFilter = (table.state.globalFilter as string | undefined) ?? '';
  const positionFilter = (table.getColumn('position')?.getFilterValue() as string) ?? ALL;
  const managerFilter = (table.getColumn('managerName')?.getFilterValue() as string) ?? ALL;
  const filtered = globalFilter !== '' || table.state.columnFilters.length > 0;
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
        <TextFilters
          columns={[
            { column: table.getColumn('firstName'), label: 'First name' },
            { column: table.getColumn('lastName'), label: 'Surname' },
            { column: table.getColumn('employeeNumber'), label: 'Employee number' },
            { column: table.getColumn('email'), label: 'Email' },
          ]}
        />
        <RangeFilter
          column={table.getColumn('birthDate')}
          label="Birth date"
          icon={CalendarRange}
          type="date"
          format={formatDate}
        />
        {isAdmin && (
          <RangeFilter
            column={table.getColumn('salary')}
            label="Salary"
            icon={Banknote}
            type="number"
            format={(v) => formatSalary(Number(v))}
          />
        )}
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
                {row.getVisibleCells().map((cell) => (
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
                  colSpan={table.getVisibleLeafColumns().length}
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

/**
 * A from/to filter in a popover, for the columns a dropdown cannot cover: birth date and
 * salary. Either end may be left blank; TanStack's `inDateRange` and `inNumberRange` treat
 * a blank end as open and drop the filter once both are blank.
 */
function RangeFilter({
  column,
  label,
  icon: Icon,
  type,
  format,
}: {
  column: Column<typeof features, Row> | undefined;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  type: 'date' | 'number';
  format: (value: string) => string;
}) {
  if (!column) return null;
  const [from, to] = (column.getFilterValue() as Range | undefined) ?? ['', ''];
  const set = (next: Range) =>
    column.setFilterValue(next[0] === '' && next[1] === '' ? undefined : next);

  const summary =
    from && to
      ? `${format(from)} – ${format(to)}`
      : from
        ? `From ${format(from)}`
        : to
          ? `Up to ${format(to)}`
          : label;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label={`Filter by ${label.toLowerCase()}`}
          className={cn((from || to) && 'border-primary/50')}
        >
          <Icon className="size-4" /> {summary}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={`${column.id}-from`}>{label} from</Label>
          <Input
            id={`${column.id}-from`}
            type={type}
            min={type === 'number' ? 0 : undefined}
            value={from}
            onChange={(e) => set([e.target.value, to])}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${column.id}-to`}>{label} to</Label>
          <Input
            id={`${column.id}-to`}
            type={type}
            min={type === 'number' ? 0 : undefined}
            value={to}
            onChange={(e) => set([from, e.target.value])}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * "Contains" filters for the text fields, together in one popover so the toolbar stays
 * short. The search box already looks across all of them; these narrow one field each.
 */
function TextFilters({
  columns,
}: {
  columns: { column: Column<typeof features, Row> | undefined; label: string }[];
}) {
  const active = columns.filter(({ column }) => column?.getFilterValue()).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label="Filter by name, number or email"
          className={cn(active > 0 && 'border-primary/50')}
        >
          <SlidersHorizontal className="size-4" /> {active > 0 ? `Details (${active})` : 'Details'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="grid gap-3">
        {columns.map(
          ({ column, label }) =>
            column && (
              <div key={column.id} className="grid gap-1.5">
                <Label htmlFor={`${column.id}-contains`}>{label} contains</Label>
                <Input
                  id={`${column.id}-contains`}
                  value={(column.getFilterValue() as string | undefined) ?? ''}
                  onChange={(e) => column.setFilterValue(e.target.value || undefined)}
                />
              </div>
            ),
        )}
      </PopoverContent>
    </Popover>
  );
}
