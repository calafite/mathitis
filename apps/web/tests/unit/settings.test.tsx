import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SettingsPage } from '@/pages/settings';
import { ThemeProvider } from '@/contexts/theme-context';
import { settingsApi } from '@/lib/settings-api';

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { handle: 'test_user', email: 'test_user@cs.uni.edu', role: 'freshman', semester: 1 },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    register: vi.fn(),
  }),
}));

vi.mock('@/contexts/notifications-context', () => ({
  useNotifications: () => ({
    muted: false,
    toggleMuted: vi.fn(),
  }),
}));

vi.mock('@/lib/requests-api', () => ({
  requestsApi: {
    list: vi.fn().mockResolvedValue({ requests: [] }),
  },
}));

vi.mock('@/lib/settings-api', () => ({
  settingsApi: {
    get: vi.fn().mockResolvedValue({
      email: 'test_user@cs.uni.edu',
      semester: 1,
      preferences: null,
    }),
    changePassword: vi.fn(),
    updateAccount: vi.fn().mockResolvedValue({ ok: true }),
    exportData: vi.fn(),
    anonymize: vi.fn(),
  },
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ThemeProvider>
          <SettingsPage />
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the five settings tabs', async () => {
    renderPage();
    expect(await screen.findByRole('tab', { name: /Conta e Segurança/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Aparência/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Notificações/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Dados e Linhagem/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Zona de Risco/ })).toBeInTheDocument();
  });

  it('submits the change-password form on the account tab', async () => {
    const user = userEvent.setup();
    (settingsApi.changePassword as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    renderPage();

    await user.type(screen.getByLabelText(/Senha atual/), 'OldPassword123!');
    await user.type(screen.getByLabelText(/Nova senha/), 'NewPassword123!');
    await user.click(screen.getByRole('button', { name: 'Atualizar senha' }));

    await waitFor(() => {
      expect(settingsApi.changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
      });
    });
    expect(await screen.findByText(/senha foi atualizada/i)).toBeInTheDocument();
  });

  it('switches tabs and renders the theme selector', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('tab', { name: /Aparência/ }));

    expect(await screen.findByRole('button', { name: /Escuro/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Claro/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sincronizar com o sistema/ })).toBeInTheDocument();
  });

  it('downloads data export from the Data & Lineage tab', async () => {
    const user = userEvent.setup();
    (settingsApi.exportData as ReturnType<typeof vi.fn>).mockResolvedValue({
      user: { handle: 'test_user' },
      tags: [],
      richCards: [],
      sentRequests: [],
      receivedRequests: [],
      lineage: { ancestors: [], descendants: [] },
    });

    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    renderPage();
    await user.click(screen.getByRole('tab', { name: /Dados e Linhagem/ }));
    await user.click(await screen.findByRole('button', { name: /Baixar meus dados/ }));

    await waitFor(() => {
      expect(settingsApi.exportData).toHaveBeenCalled();
    });
    expect(await screen.findByText(/arquivo de dados foi baixado/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});