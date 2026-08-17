import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-lg font-semibold text-slate-900">Mathitis</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">
              {user?.socialName ?? user?.handle} · {user?.role}
            </span>
            <Link to="/profile/studio">
              <Button variant="outline" size="sm">
                Profile studio
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-12">
        <h1 className="text-3xl font-bold text-slate-900">Welcome to the mathematics lineage.</h1>
        <p className="mt-2 text-slate-600">
          Discovery, requests, and mentorship tools are coming in the next phases.
        </p>
      </main>
    </div>
  );
}
