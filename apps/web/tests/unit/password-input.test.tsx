import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordInput } from '../../src/components/ui/password-input';

describe('PasswordInput', () => {
  it('renders a password field by default and toggles visibility via the reveal button', async () => {
    const user = userEvent.setup();
    render(<PasswordInput id="password" placeholder="senha" />);

    const input = screen.getByPlaceholderText('senha') as HTMLInputElement;
    expect(input.type).toBe('password');

    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    await user.click(toggle);

    expect(input.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Ocultar senha' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ocultar senha' }));
    expect(input.type).toBe('password');
  });

  it('keeps the toggle outside form submission (type=button)', () => {
    render(<PasswordInput />);
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(toggle.getAttribute('type')).toBe('button');
  });
});
