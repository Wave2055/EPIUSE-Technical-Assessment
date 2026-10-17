import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Loading } from '@/components/loading';
import { AppLayout } from './app-layout';
import { EmployeesRoute } from './employees';
import { LoginRoute } from './login';
import { NotFoundRoute } from './not-found';

/**
 * React Flow plus d3-hierarchy is meaningful bundle weight, so the chart route is
 * lazy-loaded and kept out of the initial payload (ADR-0005).
 *
 * SPA routing on S3 needs a CloudFront error-response rule mapping 403/404 to /index.html,
 * or a hard refresh of a deep link 404s (ADR-0005, ADR-0016).
 */
const HierarchyRoute = lazy(() =>
  import('./hierarchy').then((m) => ({ default: m.HierarchyRoute })),
);
const AuditRoute = lazy(() => import('./audit').then((m) => ({ default: m.AuditRoute })));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/hierarchy" replace /> },
      {
        path: 'hierarchy',
        element: (
          <Suspense fallback={<Loading />}>
            <HierarchyRoute />
          </Suspense>
        ),
      },
      { path: 'employees', element: <EmployeesRoute /> },
      {
        path: 'audit',
        element: (
          <Suspense fallback={<Loading />}>
            <AuditRoute />
          </Suspense>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundRoute /> },
]);
