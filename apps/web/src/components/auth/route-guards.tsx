import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { UserRole } from '@mathitis/schemas';
import { useAuth } from '@/contexts/auth-context';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

interface RoleGuardProps {
  requiredRole: UserRole[];
  children: React.ReactNode;
}

export function RoleGuard({ requiredRole, children }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!user || !requiredRole.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function isStudentRole(role: UserRole | undefined) {
  return role === 'freshman' || role === 'senior';
}

function isOnboarded(
  user: { role?: UserRole; preferences?: { onboarded?: boolean } | null } | null,
) {
  if (!user) return false;
  if (!isStudentRole(user.role)) return true;
  return user.preferences?.onboarded === true;
}

/**
 * Wraps the main authenticated app. Students who have not finished onboarding
 * are steered toward the guided flow; other roles skip it entirely.
 */
export function OnboardingGate() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isOnboarded(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}

/**
 * Guards the `/onboarding` page: only students who have NOT completed the flow
 * may access it. Admin/developer and already-onboarded students are sent home.
 */
export function OnboardingRoute() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isOnboarded(user)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
