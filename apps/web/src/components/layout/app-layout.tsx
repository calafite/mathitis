import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const APP_VERSION = __APP_VERSION__;

const NAV_ITEMS = [
  { to: '/', label: 'Início', end: true },
  { to: '/discovery', label: 'Descoberta de Padrinhos', end: false },
  { to: '/requests', label: 'Pedidos', end: false },
  { to: '/lineage', label: 'Linhagem', end: false },
  { to: '/profile/studio', label: 'Estúdio', end: false },
  { to: '/settings', label: 'Configurações', end: false },
];

export function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <NavLink
              to="/"
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              Mathitis
            </NavLink>
            <nav className="flex items-center gap-4">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `text-sm font-medium transition-colors ${
                      isActive
                        ? 'text-foreground underline decoration-primary underline-offset-4'
                        : 'text-muted-foreground hover:text-foreground'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle />
            {user?.handle && (
              <span className="text-sm text-muted-foreground">@{user.handle}</span>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-md px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sair
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row">
          <span>
            <span className="font-semibold text-foreground">Mathitis</span>{' '}
            <span aria-hidden>·</span> μαθητής <span aria-hidden>·</span> © {new Date().getFullYear()}{' '}
            Programa de Apadrinhamento Acadêmico
          </span>
          <span className="flex items-center gap-4">
            <Link to="/lineage" className="hover:text-foreground">
              Linhagem
            </Link>
            <Link to="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
            <span>v{APP_VERSION}</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
