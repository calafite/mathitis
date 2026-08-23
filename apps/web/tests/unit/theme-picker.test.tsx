import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemePicker } from '@/components/profile/theme-picker';

const value = {
  primaryColor: '#6366f1',
  accentColor: '#ec4899',
  badgeColor: '#3b82f6',
  cardStyle: 'glassmorphic' as const,
};

describe('ThemePicker', () => {
  it('renders the current colour values and selected card style', () => {
    render(<ThemePicker value={value} onChange={() => {}} />);

    const primary = screen.getByLabelText(/^Primária/) as HTMLInputElement;
    expect(primary.value).toBe('#6366f1');

    const solid = screen.getByRole('button', { name: 'Sólido' });
    expect(solid.className).not.toContain('border-primary');
    const glass = screen.getByRole('button', { name: 'Vidro fosco' });
    expect(glass.className).toContain('border-primary');
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
      cardStyle: 'solid',
    });
  });

  it('emits a partial update when a colour input changes', () => {
    const onChange = vi.fn();
    render(<ThemePicker value={value} onChange={onChange} />);

    const accent = screen.getByLabelText(/Destaque/) as HTMLInputElement;
    fireEvent.change(accent, { target: { value: '#111111' } });

    expect(onChange).toHaveBeenCalledWith({ ...value, accentColor: '#111111' });
  });

  it('emits a card style change keeping the rest of the palette', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ThemePicker value={value} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'com borda' }));

    expect(onChange).toHaveBeenCalledWith({ ...value, cardStyle: 'bordered' });
  });
});
