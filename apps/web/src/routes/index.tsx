import { lazy, Suspense } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import { Loading } from '@/components/loading';
import { RequireAuth } from '@/features/auth/require-auth';
import { AppLayout } from './app-layout';
import { ChangePasswordRoute } from './change-password';
import { EmployeesRoute } from './employees';
import { HomeRoute } from './home';
import { LoginRoute } from './login';
import { NotFoundRoute } from './not-found';

/**
 * React Flow plus d3-hierarchy is meaningful bundle weight, so the chart route is
 * lazy-loaded and kept out of the initial payload (ADR-0005).
 *
 * A hard refresh of a deep link works because a CloudFront function serves index.html for
 * any path without a file extension (ADR-0016, infra/modules/cdn).
 */
const HierarchyRoute = lazy(() =>
  import('./hierarchy').then((m) => ({ default: m.HierarchyRoute })),
);
const AuditRoute = lazy(() => import('./audit').then((m) => ({ default: m.AuditRoute })));
const UsersRoute = lazy(() => import('./users').then((m) => ({ default: m.UsersRoute })));

export const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute /> },
  {
    path: '/change-password',
    element: (
      <RequireAuth>
        <ChangePasswordRoute />
      </RequireAuth>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomeRoute /> },
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
      {
        path: 'users',
        element: (
          <Suspense fallback={<Loading />}>
            <UsersRoute />
          </Suspense>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundRoute /> },
]);
