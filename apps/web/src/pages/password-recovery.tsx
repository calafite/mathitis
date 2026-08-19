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

export function PasswordRecoveryPage() {
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
      setMessage('If an account with that email exists, a reset link has been sent.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to process the request. Please try again.');
      }
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <header className="mb-6 flex justify-end">
          <ThemeToggle />
        </header>
        <h1 className="text-2xl font-semibold text-foreground">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your email address and we will send you a reset link if an account exists.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
              Email
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
            <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600" role="status">
              {message}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link to="/login" className="text-primary hover:underline">
            Back to sign in
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
      setMessage('Your password has been reset. You can now sign in.');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Unable to reset your password. Please try again.');
      }
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <header className="mb-6 flex justify-end">
          <ThemeToggle />
        </header>
        <h1 className="text-2xl font-semibold text-foreground">Choose a new password</h1>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-foreground">
              New password
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
            <div className="rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600" role="status">
              {message}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
