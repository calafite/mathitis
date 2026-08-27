import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DevDiagnosticsPage } from '@/pages/dev/dev-diagnostics';
import { ThemeProvider } from '@/contexts/theme-context';
import { devApi } from '@/lib/dev-api';

vi.mock('@/lib/dev-api', () => ({
  devApi: {
    health: vi.fn(),
    metrics: vi.fn(),
    mailbox: vi.fn(),
    listAdmins: vi.fn(),
    promoteAdmin: vi.fn(),
    revokeAdmin: vi.fn(),
  },
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

const mockedDevApi = vi.mocked(devApi);

const admins = {
  admins: [
    {
      id: 'admin-1',
      handle: 'managed_admin',
      email: 'managed_admin@cs.uni.edu',
      role: 'administrator' as const,
      semester: 8,
      socialName: 'Gerenciado',
      createdAt: new Date('2026-02-01').toISOString() as unknown as Date,
    },
    {
      id: 'dev-1',
      handle: 'dev_ops',
      email: 'dev_ops@cs.uni.edu',
      role: 'developer' as const,
      semester: 10,
      socialName: null,
      createdAt: new Date('2026-01-01').toISOString() as unknown as Date,
    },
  ],
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <DevDiagnosticsPage />
        </QueryClientProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('DevDiagnosticsPage admin management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDevApi.health.mockResolvedValue({
      status: 'ok',
      uptimeSeconds: 10,
      timestamp: new Date().toISOString(),
      checks: { database: 'ok', redis: 'ok', queue: 'ok' },
    } as never);
    mockedDevApi.metrics.mockResolvedValue({ metrics: undefined } as never);
    mockedDevApi.mailbox.mockResolvedValue({ emails: [] } as never);
    mockedDevApi.listAdmins.mockResolvedValue(admins as never);
  });

  it('renders the administrator roster with revoke actions', async () => {
    renderPage();

    expect(await screen.findByTestId('admin-management')).toBeInTheDocument();
    expect(await screen.findByText('Gerenciado')).toBeInTheDocument();
    expect(screen.getByText(/@managed_admin/)).toBeInTheDocument();

    // Developers are listed but never offer a revoke button.
    expect(screen.getByText(/@dev_ops/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /revogar administrador dev_ops/i })).toBeNull();
    expect(
      screen.getByRole('button', { name: /revogar administrador managed_admin/i }),
    ).toBeInTheDocument();
  });

  it('promotes via the form and invalidates the roster', async () => {
    const user = userEvent.setup();
    mockedDevApi.promoteAdmin.mockResolvedValue({
      admin: { ...admins.admins[0]!, handle: 'promote_me' },
    } as never);

    renderPage();
    await screen.findByTestId('admin-management');

    await user.type(screen.getByLabelText('Identificador do novo administrador'), 'promote_me');
    await user.click(screen.getByRole('button', { name: /promover novo administrador/i }));

    await waitFor(() => {
      expect(mockedDevApi.promoteAdmin).toHaveBeenCalledWith('promote_me');
    });
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/administrador promovido/i);
    });
  });

  it('requires confirmation before revoking', async () => {
    const user = userEvent.setup();
    renderPage();

    const revokeButton = await screen.findByRole('button', {
      name: /revogar administrador managed_admin/i,
    });
    await user.click(revokeButton);
    expect(mockedDevApi.revokeAdmin).not.toHaveBeenCalled();

    // The revoke button is replaced by an explicit confirmation step.
    await user.click(await screen.findByRole('button', { name: /revogar acesso/i }));
    await waitFor(() => {
      expect(mockedDevApi.revokeAdmin).toHaveBeenCalledWith('admin-1');
    });
  });
});
