import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/lib/errors';

/** A failed load, in place of the content it was meant to show, with a way to try again. */
export function QueryError({
  error,
  onRetry,
  title = 'This could not be loaded',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  return (
    <div className="flex h-full items-start justify-center p-6">
      <Alert variant="destructive" className="max-w-lg">
        <TriangleAlert />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="grid gap-3">
          <p>{errorMessage(error)}</p>
          {onRetry && (
            <Button size="sm" variant="outline" className="w-fit" onClick={onRetry}>
              Try again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </div>
  );
}
