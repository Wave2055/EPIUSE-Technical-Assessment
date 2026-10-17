import { ChevronDown, LogOut } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Role } from '@/features/employees/types';
import { cn } from '@/lib/utils';
import { setRole, useRole } from '@/mocks/store';

const navItems = [
  { to: '/', label: 'Home', end: true },
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
              end={'end' in item}
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
        <UserMenu />
      </header>
      <main className="min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

/** Signed-in user. The role switch is a design aid for previewing salary masking (ADR-0014). */
function UserMenu() {
  const role = useRole();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ml-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-header-muted hover:text-header-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span className="grid size-7 place-items-center rounded-full bg-header-foreground/10 text-xs font-semibold text-header-foreground">
          AD
        </span>
        <span className="hidden sm:inline">admin@example.com</span>
        <ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Preview as</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={role} onValueChange={(v) => setRole(v as Role)}>
          <DropdownMenuRadioItem value="ADMIN">Admin (full access)</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="VIEWER">Viewer (read-only)</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/login')}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
