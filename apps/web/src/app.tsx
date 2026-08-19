import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/auth-context';
import { NotificationsProvider } from '@/contexts/notifications-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { NotificationToastStack } from '@/components/notifications/toast-stack';
import { ProtectedRoute, RoleGuard } from '@/components/auth/route-guards';
import { ErrorBoundary } from '@/components/error-boundary';
import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/login';
import { RegisterPage } from '@/pages/register';
import { PasswordRecoveryPage } from '@/pages/password-recovery';
import { VerifyEmailPage } from '@/pages/verify-email';
import { ProfileStudioPage } from '@/pages/profile-studio';
import { DiscoveryPage } from '@/pages/discovery';
import { RequestsPage } from '@/pages/requests';
import { LineagePage } from '@/pages/lineage';
import { SettingsPage } from '@/pages/settings';
import { AdminLayout } from '@/pages/admin/admin-layout';
import { AdminDashboardPage } from '@/pages/admin/admin-dashboard';
import { AdminUsersPage } from '@/pages/admin/admin-users';
import { AdminApprovalsPage } from '@/pages/admin/admin-approvals';
import { AdminConfigPage } from '@/pages/admin/admin-config';
import { AdminAuditLogsPage } from '@/pages/admin/admin-audit-logs';
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
          <ThemeProvider>
            <AuthProvider>
              <NotificationsProvider>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/recover" element={<PasswordRecoveryPage />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />

                  <Route element={<ProtectedRoute />}>
                    <Route
                      path="/"
                      element={
                        <ErrorBoundary name="protected">
                          <HomePage />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/profile/studio"
                      element={
                        <ErrorBoundary name="profile-studio">
                          <ProfileStudioPage />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/discovery"
                      element={
                        <ErrorBoundary name="discovery">
                          <DiscoveryPage />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/requests"
                      element={
                        <ErrorBoundary name="requests">
                          <RequestsPage />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/lineage"
                      element={
                        <ErrorBoundary name="lineage">
                          <LineagePage />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/lineage/:handle"
                      element={
                        <ErrorBoundary name="lineage">
                          <LineagePage />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/settings"
                      element={
                        <ErrorBoundary name="settings">
                          <SettingsPage />
                        </ErrorBoundary>
                      }
                    />
                  </Route>

                  <Route
                    path="/admin"
                    element={
                      <RoleGuard requiredRole={['administrator']}>
                        <ErrorBoundary name="admin">
                          <AdminLayout />
                        </ErrorBoundary>
                      </RoleGuard>
                    }
                  >
                    <Route index element={<AdminDashboardPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="approvals" element={<AdminApprovalsPage />} />
                    <Route path="config" element={<AdminConfigPage />} />
                    <Route path="audit-logs" element={<AdminAuditLogsPage />} />
                  </Route>

                  <Route
                    path="/dev"
                    element={
                      <RoleGuard requiredRole={['developer', 'administrator']}>
                        <ErrorBoundary name="dev">
                          <DevDiagnosticsPage />
                        </ErrorBoundary>
                      </RoleGuard>
                    }
                  />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <NotificationToastStack />
              </NotificationsProvider>
            </AuthProvider>
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}