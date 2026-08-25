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
      <header className="sticky top-0 z-40 border-b-2 border-[#c9ced8]/15 bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <NavLink
              to="/"
              className="font-mono text-base font-bold uppercase tracking-[0.2em] text-foreground"
            >
              Mathitis
            </NavLink>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-1">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `font-mono text-[11px] font-bold uppercase tracking-widest transition-colors ${
                      isActive
                        ? 'text-foreground underline decoration-[#ff4d14] decoration-2 underline-offset-4'
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
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                @{user.handle}
              </span>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground"
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
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground sm:flex-row">
          <span>
            © {new Date().getFullYear()} <span className="font-bold text-foreground">Mathitis</span>
            <span aria-hidden className="mx-2">·</span>
            Programa de Apadrinhamento Acadêmico
          </span>
          <span className="flex items-center gap-5">
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
