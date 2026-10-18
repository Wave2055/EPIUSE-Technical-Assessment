import { ChevronDown, LogOut } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser, useSession } from '@/features/auth/use-session';
import { cn } from '@/lib/utils';

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

/** The signed-in user, their role, and sign out. */
function UserMenu() {
  const user = useCurrentUser();
  const { logout } = useSession();
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="ml-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-header-muted hover:text-header-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
        <span className="grid size-7 place-items-center rounded-full bg-header-foreground/10 text-xs font-semibold text-header-foreground uppercase">
          {user.email.slice(0, 2)}
        </span>
        <span className="hidden sm:inline">{user.email}</span>
        <ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="grid gap-0.5">
          <span className="truncate">{user.email}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {user.role === 'ADMIN' ? 'Administrator' : 'Viewer: read-only, salaries hidden'}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => void logout().then(() => navigate('/login', { replace: true }))}
        >
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
