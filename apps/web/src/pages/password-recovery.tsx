import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  recoverBodySchema,
  resetPasswordBodySchema,
  type RecoverBody,
  type ResetPasswordBody,
} from '@mathitis/schemas';
import { authApi } from '@/lib/auth-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { usePageMeta } from '@/lib/use-page-meta';

export function PasswordRecoveryPage() {
  usePageMeta('Recuperar senha', 'Redefina a senha da sua conta Mathitis com segurança.');
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  if (token) {
    return <ResetPassword token={token} />;
  }
  return <RequestRecovery />;
}

function RequestRecovery() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RecoverBody>({
    resolver: zodResolver(recoverBodySchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setMessage(null);
    try {
      await authApi.recover(values);
      setMessage('Se existir uma conta com esse e-mail, um link de redefinição foi enviado.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível processar a solicitação. Tente novamente.');
      }
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div
        className="auth-card-light w-full max-w-md border-2 border-black bg-[#d3d7de] p-8 text-[#0b0b0e]"
        style={{ boxShadow: '10px 10px 0 0 rgba(201, 206, 216, 0.18)' }}
      >
        <header className="mb-6 flex justify-end">
          <ThemeToggle />
        </header>
        <h1 className="font-sans text-2xl font-bold uppercase tracking-tight">
          Redefinir sua senha
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Informe seu endereço de e-mail e enviaremos um link de redefinição se uma conta existir.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label
              htmlFor="email"
              className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest"
            >
              E-mail
            </label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            <FieldError message={errors.email?.message} />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div
              className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600"
              role="status"
            >
              {message}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Enviando…' : 'Enviar link de redefinição'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">
            Voltar para o login
          </Link>
        </p>
      </div>
    </div>
  );
}

function ResetPassword({ token }: { token: string }) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordBody>({
    resolver: zodResolver(resetPasswordBodySchema),
    defaultValues: { token, password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setMessage(null);
    try {
      await authApi.resetPassword({ token, password: values.password });
      setMessage('Sua senha foi redefinida. Agora você pode entrar.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível redefinir sua senha. Tente novamente.');
      }
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div
        className="auth-card-light w-full max-w-md border-2 border-black bg-[#d3d7de] p-8 text-[#0b0b0e]"
        style={{ boxShadow: '10px 10px 0 0 rgba(201, 206, 216, 0.18)' }}
      >
        <header className="mb-6 flex justify-end">
          <ThemeToggle />
        </header>
        <h1 className="font-sans text-2xl font-bold uppercase tracking-tight">
          Escolha uma nova senha
        </h1>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label
              htmlFor="new-password"
              className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest"
            >
              Nova senha
            </label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
            <FieldError message={errors.password?.message} />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          {message && (
            <div
              className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600"
              role="status"
            >
              {message}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Redefinindo…' : 'Redefinir senha'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  );
}
