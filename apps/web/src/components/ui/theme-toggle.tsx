import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/theme-context';
import { Button } from '@/components/ui/button';
import { playUiSound } from '@/lib/ui-sounds';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        playUiSound('clack');
        toggleTheme();
      }}
      aria-label={theme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
      title={theme === 'dark' ? 'Alternar para tema claro' : 'Alternar para tema escuro'}
    >
      {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  );
}
