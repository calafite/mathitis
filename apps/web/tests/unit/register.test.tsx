import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '@/pages/register';
import { ThemeProvider } from '@/contexts/theme-context';

const register = vi.fn();

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    register,
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <RegisterPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    register.mockReset();
  });

  it('submits the form and shows the generic success message', async () => {
    const user = userEvent.setup();
    register.mockResolvedValue(undefined);
    renderPage();

    await user.type(screen.getByLabelText(/Nome de usuário/), 'new_student');
    await user.type(screen.getByLabelText(/Email Acadêmico/), 'new_student@cs.uni.edu');
    const semester = screen.getByLabelText(/^Período/) as HTMLInputElement;
    await user.clear(semester);
    await user.type(semester, '2');
    await user.type(screen.getByLabelText(/Senha/), 'StrongPassword123!');

    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        handle: 'new_student',
        email: 'new_student@cs.uni.edu',
        password: 'StrongPassword123!',
        semester: 2,
        socialName: '',
      });
    });
    expect(screen.getByRole('heading', { name: 'Verifique seu e-mail' })).toBeInTheDocument();
  });

  it('surfaces validation errors for an invalid email', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Nome de usuário/), 'new_student');
    await user.type(screen.getByLabelText(/Email Acadêmico/), 'not-an-email');
    await user.type(screen.getByLabelText(/Senha/), 'short');

    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByText('Informe um endereço de e-mail válido')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('shows a friendly error when registration rejects', async () => {
    const user = userEvent.setup();
    register.mockRejectedValue(new Error('boom'));
    renderPage();

    await user.type(screen.getByLabelText(/Nome de usuário/), 'new_student');
    await user.type(screen.getByLabelText(/Email Acadêmico/), 'new_student@cs.uni.edu');
    const semester = screen.getByLabelText(/^Período/) as HTMLInputElement;
    await user.clear(semester);
    await user.type(semester, '2');
    await user.type(screen.getByLabelText(/Senha/), 'StrongPassword123!');

    await user.click(screen.getByRole('button', { name: 'Criar conta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível completar o registro');
  });
});
