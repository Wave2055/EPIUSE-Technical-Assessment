/**
 * Audit trail, ADMIN only. Rows are written by database triggers, so this view is read-only
 * by construction (ADR-0011).
 */
export function AuditRoute() {
  return (
    <section className="h-full p-6">
      <h1 className="text-lg font-semibold">Audit trail</h1>
      <p className="mt-2 text-sm text-muted-foreground">Audit log view pending.</p>
    </section>
  );
}
