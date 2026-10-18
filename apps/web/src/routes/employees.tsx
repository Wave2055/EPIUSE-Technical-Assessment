import {
  createColumnHelper,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type Column,
  type SortingState,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useIsAdmin } from '@/features/auth/use-session';
import { useEmployeeList, useHierarchy } from '@/features/employees/api';
import { DeleteEmployeeDialog } from '@/features/employees/delete-employee-dialog';
import { EmployeeAvatar } from '@/features/employees/employee-avatar';
import { EmployeeFormSheet } from '@/features/employees/employee-form-sheet';
import { formatDate, formatSalary, fullName } from '@/features/employees/format';
import type { Employee } from '@/features/employees/types';
import { errorMessage } from '@/lib/api-errors';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';

// Sorting, searching, filtering and paging all happen in the API, so the table only needs
// the sorting feature for its header state.
const features = tableFeatures({
  rowSortingFeature,
  columnMeta: {} as { align?: 'left' | 'right' },
});

const col = createColumnHelper<typeof features, Employee>();

const ALL = 'all';
const NO_MANAGER = 'none';
const PAGE_SIZE = 25;

/**
 * The reporting table: the brief's second required surface, sortable and filterable on any
 * employee field.
 *
 * The API owns search, sort, filter and paging (ADR-0005). Column ids match the API's sort
 * allowlist. Salary sorting is switched off for a VIEWER, because the API refuses it: the
 * order alone would leak a value it masks (ADR-0014).
 */
export function EmployeesRoute() {
  const isAdmin = useIsAdmin();
  const [editing, setEditing] = useState<Employee | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const [sorting, setSorting] = useState<SortingState>([{ id: 'name', desc: false }]);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState(ALL);
  const [managerId, setManagerId] = useState(ALL);
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim());

  const sort = sorting[0] ? `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}` : 'name:asc';
  const list = useEmployeeList({
    q: q || undefined,
    sort,
    position: position === ALL ? undefined : position,
    managerId: managerId === ALL ? undefined : managerId,
    page,
    pageSize: PAGE_SIZE,
  });

  // Filter choices come from the whole organisation, not just the current page.
  const nodes = useHierarchy().data?.nodes;
  const positions = useMemo(
    () => [...new Set((nodes ?? []).map((n) => n.position))].sort(),
    [nodes],
  );
  const managers = useMemo(() => {
    const ids = new Set((nodes ?? []).map((n) => n.managerId).filter(Boolean));
    return (nodes ?? [])
      .filter((n) => ids.has(n.id))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [nodes]);

  const columns = useMemo(
    () =>
      col.columns([
        col.accessor((e) => fullName(e), {
          id: 'name',
          header: 'Name',
          cell: ({ row }) => (
            <div className="flex items-center gap-3">
              <EmployeeAvatar employee={row.original} />
              <div className="grid">
                <span className="font-medium text-heading">{fullName(row.original)}</span>
                <span className="text-xs text-muted-foreground">{row.original.email}</span>
              </div>
            </div>
          ),
        }),
        col.accessor('employeeNumber', {
          header: 'Number',
          cell: (info) => <span className="font-mono text-xs">{info.getValue()}</span>,
        }),
        col.accessor('position', { header: 'Role' }),
        col.accessor((e) => (e.manager ? fullName(e.manager) : ''), {
          id: 'manager',
          header: 'Manager',
          cell: (info) =>
            info.getValue() || (
              <Badge variant="outline" className="border-warning/40 text-warning">
                No manager
              </Badge>
            ),
        }),
        col.accessor('birthDate', {
          header: 'Birth date',
          cell: (info) => formatDate(info.getValue()),
        }),
        col.accessor('salary', {
          header: 'Salary',
          enableSorting: isAdmin,
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
                    aria-label={`Actions for ${fullName(row.original)}`}
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

  const items = list.data?.items ?? [];
  const table = useTable({
    features,
    columns,
    data: items,
    manualSorting: true,
    enableSortingRemoval: false,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting(updater);
      setPage(1);
    },
  });

  const total = list.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = search !== '' || position !== ALL || managerId !== ALL;
  const rows = table.getRowModel().rows;

  function resetTo<T>(set: (value: T) => void) {
    return (value: T) => {
      set(value);
      setPage(1);
    };
  }

  return (
    <section className="mx-auto flex h-full max-w-7xl flex-col gap-4 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Employees</h1>
          <p className="text-sm text-muted-foreground">
            {list.data ? `${total} ${filtered ? 'matching ' : ''}employees` : 'Loading…'}
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
            value={search}
            onChange={(e) => resetTo(setSearch)(e.target.value)}
            placeholder="Search name, number, email or role"
            className="pl-8"
            aria-label="Search employees"
          />
        </div>
        <Select value={position} onValueChange={resetTo(setPosition)}>
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
        <Select value={managerId} onValueChange={resetTo(setManagerId)}>
          <SelectTrigger className="w-48" aria-label="Filter by manager">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All managers</SelectItem>
            <SelectItem value={NO_MANAGER}>No manager</SelectItem>
            {managers.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {fullName(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setPosition(ALL);
              setManagerId(ALL);
              setPage(1);
            }}
          >
            <X /> Clear
          </Button>
        )}
      </div>

      {list.isError && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(list.error)}</AlertDescription>
        </Alert>
      )}

      <div
        className={cn(
          'min-h-0 flex-1 overflow-auto rounded-lg border transition-opacity',
          list.isPlaceholderData && 'opacity-60',
        )}
      >
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
            {list.isPending &&
              Array.from({ length: 6 }, (_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={columns.length}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))}
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
            {list.isSuccess && rows.length === 0 && (
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

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-end gap-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight />
          </Button>
        </div>
      )}

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
  column: Column<typeof features, Employee>;
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
