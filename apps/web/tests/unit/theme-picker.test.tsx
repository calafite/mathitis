import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemePicker } from '@/components/profile/theme-picker';

const value = {
  primaryColor: '#6366f1',
  accentColor: '#ec4899',
  badgeColor: '#3b82f6',
};

describe('ThemePicker', () => {
  it('renders the current colour values', () => {
    render(<ThemePicker value={value} onChange={() => {}} />);

    const primary = screen.getByLabelText(/^Primária/) as HTMLInputElement;
    expect(primary.value).toBe('#6366f1');
  });

  it('applies a preset palette when a preset swatch is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ThemePicker value={value} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Aplicar predefinição de tema 2' }));

    expect(onChange).toHaveBeenCalledWith({
      primaryColor: '#0ea5e9',
      accentColor: '#22c55e',
      badgeColor: '#f59e0b',
    });
  });

  it('emits a partial update when a colour input changes', () => {
    const onChange = vi.fn();
    render(<ThemePicker value={value} onChange={onChange} />);

    const accent = screen.getByLabelText(/Destaque/) as HTMLInputElement;
    fireEvent.change(accent, { target: { value: '#111111' } });

    expect(onChange).toHaveBeenCalledWith({ ...value, accentColor: '#111111' });
  });
});
