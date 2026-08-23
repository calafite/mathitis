import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/lib/auth-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';

type VerifyState = 'verifying' | 'success' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<VerifyState>('verifying');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('Este link de verificação está sem o token e é inválido.');
      return;
    }
    let cancelled = false;
    authApi
      .verifyEmail(token)
      .then(() => {
        if (!cancelled) setState('success');
      })
      .catch((err) => {
        if (cancelled) return;
        setState('error');
        setMessage(
          err instanceof ApiError ? err.message : 'Não foi possível verificar seu e-mail. Tente novamente.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <header className="mb-6 flex justify-end">
          <ThemeToggle />
        </header>
        {state === 'verifying' && (
          <>
            <h1 className="text-2xl font-semibold text-foreground">Verificando seu e-mail…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Aguarde um momento.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <h1 className="text-2xl font-semibold text-foreground">E-mail verificado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sua conta está ativa. Entre para começar a explorar mentores.
            </p>
            <Link to="/login">
              <Button className="mt-6">Voltar para o login</Button>
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <h1 className="text-2xl font-semibold text-foreground">Falha na verificação</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Você pode solicitar um novo link cadastrando-se novamente ou visitando a página de recuperação.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link to="/register">
                <Button variant="outline">Criar conta</Button>
              </Link>
              <Link to="/recover">
                <Button>Ir para a recuperação</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
