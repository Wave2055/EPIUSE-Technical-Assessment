import '@xyflow/react/dist/style.css';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type NodeTypes,
} from '@xyflow/react';
import { Pencil, Trash2, TriangleAlert, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Loading } from '@/components/loading';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsAdmin } from '@/features/auth/use-session';
import { useEmployee, useHierarchy } from '@/features/employees/api';
import { DeleteEmployeeDialog } from '@/features/employees/delete-employee-dialog';
import { EmployeeAvatar } from '@/features/employees/employee-avatar';
import { EmployeeFormSheet } from '@/features/employees/employee-form-sheet';
import { formatDate, formatSalary, fullName } from '@/features/employees/format';
import { getDirectReports, getRoots } from '@/features/employees/hierarchy';
import type { Employee, HierarchyNode } from '@/features/employees/types';
import { EmployeeNodeCard } from '@/features/hierarchy/employee-node';
import { EmployeeSearch } from '@/features/hierarchy/employee-search';
import { layoutHierarchy, NODE_HEIGHT, NODE_WIDTH } from '@/features/hierarchy/layout';
import { errorMessage } from '@/lib/api-errors';

const nodeTypes: NodeTypes = { employee: EmployeeNodeCard };

/**
 * The visual hierarchy: the brief's first required surface.
 *
 * React Flow supplies the viewport, pan, zoom, edge routing and hit testing; d3-hierarchy's
 * `tree()` supplies the layout (ADR-0005). Search centres the chart on a person, and the
 * side panel is where they are edited or deleted.
 */
export function HierarchyRoute() {
  return (
    <ReactFlowProvider>
      <OrgChart />
    </ReactFlowProvider>
  );
}

function OrgChart() {
  const chart = useHierarchy();
  const isAdmin = useIsAdmin();
  const { setCenter } = useReactFlow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ employee: Employee | null; managerId?: string }>();
  const [deleting, setDeleting] = useState<Employee | null>(null);

  const people = useMemo(() => chart.data?.nodes ?? [], [chart.data]);
  const { nodes, edges } = useMemo(() => layoutHierarchy(people), [people]);
  const roots = getRoots(people);

  function focus(person: HierarchyNode) {
    setSelectedId(person.id);
    const node = nodes.find((n) => n.id === person.id);
    if (node) {
      void setCenter(node.position.x + NODE_WIDTH / 2, node.position.y + NODE_HEIGHT / 2, {
        zoom: 1.1,
        duration: 400,
      });
    }
  }

  if (chart.isPending) return <Loading />;
  if (chart.isError) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription>{errorMessage(chart.error)}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <section className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Org chart</h1>
          <p className="text-sm text-muted-foreground">
            {people.length} employees · click a person to see their details
          </p>
        </div>
        <div className="flex items-center gap-2">
          <EmployeeSearch employees={people} onSelect={focus} />
          {isAdmin && (
            <Button onClick={() => setEditing({ employee: null })}>
              <UserPlus /> Add employee
            </Button>
          )}
        </div>
      </div>

      {roots.length > 1 && (
        <Alert className="mx-6 mt-4 w-auto border-warning/40 text-warning">
          <TriangleAlert />
          <AlertTitle>{roots.length} people have no reporting manager</AlertTitle>
          <AlertDescription className="text-foreground">
            <p>
              Usually only the CEO sits at the top. Check whether these people should report to
              someone:{' '}
              {roots.map((r, i) => (
                <span key={r.id}>
                  {i > 0 && ', '}
                  <button
                    type="button"
                    className="font-medium text-heading underline underline-offset-2"
                    onClick={() => focus(r)}
                  >
                    {fullName(r)}
                  </button>
                </span>
              ))}
            </p>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          {people.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No employees yet.{isAdmin && ' Add the first one to start the chart.'}
            </div>
          ) : (
            <ReactFlow
              nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedId }))}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              nodesDraggable={false}
              nodesConnectable={false}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={24} color="var(--border)" />
              <Controls showInteractive={false} />
              <MiniMap
                pannable
                zoomable
                nodeColor="var(--primary)"
                maskColor="rgb(20 23 35 / 0.08)"
              />
            </ReactFlow>
          )}
        </div>

        {selectedId && (
          <DetailsPanel
            id={selectedId}
            people={people}
            isAdmin={isAdmin}
            onClose={() => setSelectedId(null)}
            onFocus={focus}
            onEdit={(employee) => setEditing({ employee })}
            onAddReport={(employee) => setEditing({ employee: null, managerId: employee.id })}
            onDelete={setDeleting}
          />
        )}
      </div>

      {editing && (
        <EmployeeFormSheet
          open
          onOpenChange={(open) => !open && setEditing(undefined)}
          employee={editing.employee}
          defaultManagerId={editing.managerId}
        />
      )}
      {deleting && (
        <DeleteEmployeeDialog
          key={deleting.id}
          employee={deleting}
          onDeleted={() => setSelectedId(null)}
          onOpenChange={(open) => !open && setDeleting(null)}
        />
      )}
    </section>
  );
}

/** The selected person's full record, fetched on demand; the chart only carries the basics. */
function DetailsPanel({
  id,
  people,
  isAdmin,
  onClose,
  onFocus,
  onEdit,
  onAddReport,
  onDelete,
}: {
  id: string;
  people: HierarchyNode[];
  isAdmin: boolean;
  onClose: () => void;
  onFocus: (person: HierarchyNode) => void;
  onEdit: (employee: Employee) => void;
  onAddReport: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
}) {
  const { data: employee, isError, error } = useEmployee(id);
  const node = people.find((p) => p.id === id);
  const manager = people.find((p) => p.id === node?.managerId);
  const reports = getDirectReports(people, id);

  if (!node) return null;

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-card">
      <div className="flex items-start gap-3 p-4">
        <EmployeeAvatar employee={node} className="size-14 text-base" />
        <div className="grid min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{fullName(node)}</h2>
          <p className="text-sm text-muted-foreground">{node.position}</p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close details">
          <X />
        </Button>
      </div>

      {isAdmin && employee && (
        <div className="flex gap-2 px-4 pb-4">
          <Button size="sm" variant="outline" onClick={() => onEdit(employee)}>
            <Pencil /> Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAddReport(employee)}>
            <UserPlus /> Add report
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto text-destructive hover:text-destructive"
            onClick={() => onDelete(employee)}
            aria-label={`Delete ${fullName(node)}`}
          >
            <Trash2 />
          </Button>
        </div>
      )}

      <Separator />
      {isError ? (
        <p className="p-4 text-sm text-destructive">{errorMessage(error)}</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-4 text-sm">
          <dt className="text-muted-foreground">Number</dt>
          <dd className="font-mono">{node.employeeNumber}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd className="truncate">{employee ? employee.email : <Skeleton className="h-4" />}</dd>
          <dt className="text-muted-foreground">Born</dt>
          <dd>{employee ? formatDate(employee.birthDate) : <Skeleton className="h-4" />}</dd>
          <dt className="text-muted-foreground">Salary</dt>
          <dd className="tabular-nums">
            {employee ? formatSalary(employee.salary) : <Skeleton className="h-4" />}
          </dd>
          <dt className="text-muted-foreground">Manager</dt>
          <dd>
            {manager ? (
              <button
                type="button"
                className="text-heading underline-offset-2 hover:underline"
                onClick={() => onFocus(manager)}
              >
                {fullName(manager)}
              </button>
            ) : (
              <span className="text-warning">None</span>
            )}
          </dd>
        </dl>
      )}

      <Separator />
      <div className="p-4">
        <h3 className="mb-2 text-sm font-semibold">
          Direct reports{' '}
          <span className="font-normal text-muted-foreground">({reports.length})</span>
        </h3>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one reports to {node.firstName}.</p>
        ) : (
          <ul className="grid gap-1">
            {reports.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onFocus(r)}
                  className="flex w-full items-center gap-2 rounded-md p-1.5 text-left text-sm hover:bg-accent"
                >
                  <EmployeeAvatar employee={r} className="size-6" />
                  <span className="truncate font-medium">{fullName(r)}</span>
                  <span className="ml-auto truncate text-xs text-muted-foreground">
                    {r.position}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
