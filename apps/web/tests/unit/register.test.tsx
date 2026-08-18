import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RegisterPage } from '@/pages/register';

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
      <RegisterPage />
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

    await user.type(screen.getByLabelText(/Handle/), 'new_student');
    await user.type(screen.getByLabelText(/University email/), 'new_student@cs.uni.edu');
    const semester = screen.getByLabelText(/^Semester/) as HTMLInputElement;
    await user.clear(semester);
    await user.type(semester, '2');
    await user.type(screen.getByLabelText(/Password/), 'StrongPassword123!');

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        handle: 'new_student',
        email: 'new_student@cs.uni.edu',
        password: 'StrongPassword123!',
        semester: 2,
        socialName: '',
      });
    });
    expect(screen.getByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument();
  });

  it('surfaces validation errors for an invalid email', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/Handle/), 'new_student');
    await user.type(screen.getByLabelText(/University email/), 'not-an-email');
    await user.type(screen.getByLabelText(/Password/), 'short');

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/email/i)).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('shows a friendly error when registration rejects', async () => {
    const user = userEvent.setup();
    register.mockRejectedValue(new Error('boom'));
    renderPage();

    await user.type(screen.getByLabelText(/Handle/), 'new_student');
    await user.type(screen.getByLabelText(/University email/), 'new_student@cs.uni.edu');
    const semester = screen.getByLabelText(/^Semester/) as HTMLInputElement;
    await user.clear(semester);
    await user.type(semester, '2');
    await user.type(screen.getByLabelText(/Password/), 'StrongPassword123!');

    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to register');
  });
});
