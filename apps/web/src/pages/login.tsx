import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginBodySchema, type LoginBody } from '@mathitis/schemas';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ui/theme-toggle';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginBody>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { identifier: '', password: '' },
  });

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values.identifier, values.password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível entrar. Tente novamente.');
      }
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <header className="mb-6 flex justify-end">
          <ThemeToggle />
        </header>
        <h1 className="text-2xl font-semibold text-foreground">Junte-se ao Apadrinhamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Encontre seu mentor e faça parte da linhagem matemática.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="identifier" className="mb-1 block text-sm font-medium text-foreground">
              Nome ou email
            </label>
            <Input id="identifier" autoComplete="username" {...register('identifier')} />
            <FieldError message={errors.identifier?.message} />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
              Senha
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <Link to="/register" className="text-primary hover:underline">
            Criar conta
          </Link>
          <Link to="/recover" className="text-muted-foreground hover:underline">
            Esqueceu a senha?
          </Link>
        </div>
      </div>
    </div>
  );
}
