/**
 * Login. Posts to the API, which returns a short-lived access token held in memory and sets
 * the refresh token as an httpOnly cookie (ADR-0014).
 *
 * The form itself is not built yet: it binds to the shared zod schemas through the
 * react-hook-form resolver (ADR-0003), and those schemas are not written.
 */
export function LoginRoute() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-sm rounded-lg border p-6">
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Credential form pending the shared validation schemas.
        </p>
      </div>
    </div>
  );
}
