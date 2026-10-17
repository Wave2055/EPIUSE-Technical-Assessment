/** Suspense fallback for lazily-loaded routes (ADR-0005). */
export function Loading() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
