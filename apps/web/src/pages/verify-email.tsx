import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/lib/auth-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ErrorPage } from '@/pages/error-page';
import { usePageMeta } from '@/lib/use-page-meta';

type VerifyState = 'verifying' | 'success' | 'error';

export function VerifyEmailPage() {
  usePageMeta('Verificar e-mail', 'Confirmação de e-mail da sua conta Mathitis.');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<VerifyState>('verifying');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

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
        setError(err);
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
      <div className="auth-card-light w-full max-w-md border-2 border-black bg-[#d3d7de] p-8 text-center text-[#0b0b0e]" style={{ boxShadow: '10px 10px 0 0 rgba(201, 206, 216, 0.18)' }}>
        <header className="mb-6 flex justify-end">
          <ThemeToggle />
        </header>
        {state === 'verifying' && (
          <>
            <h1 className="font-sans text-2xl font-bold uppercase tracking-tight">Verificando seu e-mail…</h1>
            <p className="mt-2 text-sm text-muted-foreground">Aguarde um momento.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <h1 className="font-sans text-2xl font-bold uppercase tracking-tight">E-mail verificado</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sua conta está ativa. Entre para começar a explorar padrinhos.
            </p>
            <Link to="/login">
              <Button className="mt-6">Voltar para o login</Button>
            </Link>
          </>
        )}

        {state === 'error' && (
          <ErrorPage
            error={error}
            title="Falha na verificação"
            message={message ?? 'Não foi possível verificar seu e-mail.'}
          />
        )}
      </div>
    </div>
  );
}
