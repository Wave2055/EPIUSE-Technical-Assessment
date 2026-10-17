import { Link } from 'react-router-dom';

export function NotFoundRoute() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <h1 className="text-lg font-semibold">Page not found</h1>
      <Link to="/hierarchy" className="text-sm underline underline-offset-4">
        Back to the org chart
      </Link>
    </div>
  );
}
