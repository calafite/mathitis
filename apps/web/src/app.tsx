import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/auth-context';
import { ProtectedRoute, RoleGuard } from '@/components/auth/route-guards';
import { ErrorBoundary } from '@/components/error-boundary';
import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { PasswordRecoveryPage } from '@/pages/password-recovery';
import { ProfileStudioPage } from '@/pages/profile-studio';
import { DiscoveryPage } from '@/pages/discovery';
import { RequestsPage } from '@/pages/requests';
import { LineagePage } from '@/pages/lineage';
import { AdminLayout } from '@/pages/admin/admin-layout';
import { AdminDashboardPage } from '@/pages/admin/admin-dashboard';
import { AdminUsersPage } from '@/pages/admin/admin-users';
import { AdminApprovalsPage } from '@/pages/admin/admin-approvals';
import { AdminConfigPage } from '@/pages/admin/admin-config';
import { DevDiagnosticsPage } from '@/pages/dev/dev-diagnostics';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <ErrorBoundary name="root">
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/recover" element={<PasswordRecoveryPage />} />

              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/profile/studio" element={<ProfileStudioPage />} />
                <Route path="/discovery" element={<DiscoveryPage />} />
                <Route path="/requests" element={<RequestsPage />} />
                <Route path="/lineage" element={<LineagePage />} />
                <Route path="/lineage/:handle" element={<LineagePage />} />
              </Route>

              <Route
                path="/admin"
                element={
                  <RoleGuard requiredRole={['administrator']}>
                    <AdminLayout />
                  </RoleGuard>
                }
              >
                <Route index element={<AdminDashboardPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="approvals" element={<AdminApprovalsPage />} />
                <Route path="config" element={<AdminConfigPage />} />
              </Route>

              <Route
                path="/dev"
                element={
                  <RoleGuard requiredRole={['developer', 'administrator']}>
                    <DevDiagnosticsPage />
                  </RoleGuard>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}