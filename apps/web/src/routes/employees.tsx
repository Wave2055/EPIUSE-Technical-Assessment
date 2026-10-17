/**
 * The reporting table: the brief's second required surface, sortable and filterable on any
 * employee field.
 *
 * TanStack Table supplies per-column sort and filter, pagination and column visibility
 * (ADR-0005). Sorting and filtering on salary is refused for a VIEWER, because permitting it
 * would leak the ordering of a field the API has masked (ADR-0014).
 */
export function EmployeesRoute() {
  return (
    <section className="h-full p-6">
      <h1 className="text-lg font-semibold">Employees</h1>
      <p className="mt-2 text-sm text-muted-foreground">TanStack Table surface pending.</p>
    </section>
  );
}
