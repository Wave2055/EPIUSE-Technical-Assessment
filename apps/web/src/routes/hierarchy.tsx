/**
 * The visual hierarchy: the brief's first required surface.
 *
 * React Flow supplies the viewport, pan, zoom, edge routing and hit testing; d3-hierarchy's
 * `tree()` supplies the layout (ADR-0005). Collapse/expand, search-to-centre and
 * drag-a-node-onto-another to re-parent all live here, with the server's cycle rejection
 * surfaced inline (ADR-0008).
 */
export function HierarchyRoute() {
  return (
    <section className="h-full p-6">
      <h1 className="text-lg font-semibold">Org chart</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        React Flow canvas and d3-hierarchy layout pending.
      </p>
    </section>
  );
}
