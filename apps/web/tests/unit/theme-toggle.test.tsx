import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '@/contexts/theme-context';
import { ThemeToggle } from '@/components/ui/theme-toggle';

function Probe() {
  const { theme, preference } = useTheme();
  return (
    <div>
      <span data-testid="resolved">{theme}</span>
      <span data-testid="preference">{preference}</span>
      <ThemeToggle />
    </div>
  );
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark', 'light');
  });

  it('defaults to the dark theme on first visit', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('resolved')).toHaveTextContent('dark');
    expect(screen.getByLabelText('Alternar para tema claro')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles between dark and light and syncs the html class', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button'));

    expect(screen.getByTestId('resolved')).toHaveTextContent('light');
    expect(screen.getByLabelText('Alternar para tema escuro')).toBeInTheDocument();
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists the selection to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button'));
    expect(localStorage.getItem('mathitis_theme')).toBe('light');

    await user.click(screen.getByRole('button'));
    expect(localStorage.getItem('mathitis_theme')).toBe('dark');
  });
});
