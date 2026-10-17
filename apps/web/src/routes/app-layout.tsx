import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/hierarchy', label: 'Org chart' },
  { to: '/employees', label: 'Employees' },
  { to: '/audit', label: 'Audit trail' },
];

/** Application shell. The whole application sits behind a login (ADR-0014). */
export function AppLayout() {
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-6 bg-header px-6 text-header-foreground">
        <span className="flex items-center gap-2 py-3 font-semibold tracking-tight">
          <span aria-hidden className="size-2.5 rounded-full bg-brand" />
          Employee Hierarchy
        </span>
        <nav className="flex gap-1 self-stretch">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center border-b-2 px-3 text-sm transition-colors',
                  isActive
                    ? 'border-brand font-medium text-header-foreground'
                    : 'border-transparent text-header-muted hover:text-header-foreground',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
