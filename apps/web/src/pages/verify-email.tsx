import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '@/lib/auth-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';

type VerifyState = 'verifying' | 'success' | 'error';

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [state, setState] = useState<VerifyState>('verifying');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This verification link is missing its token and is invalid.');
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
          err instanceof ApiError ? err.message : 'Unable to verify your email. Please try again.',
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        {state === 'verifying' && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">Verifying your email…</h1>
            <p className="mt-2 text-sm text-slate-600">Please wait a moment.</p>
          </>
        )}

        {state === 'success' && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">Email verified</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your account is now active. Sign in to start exploring mentors.
            </p>
            <Link to="/login">
              <Button className="mt-6">Back to sign in</Button>
            </Link>
          </>
        )}

        {state === 'error' && (
          <>
            <h1 className="text-2xl font-semibold text-slate-900">Verification failed</h1>
            <p className="mt-2 text-sm text-slate-600">{message}</p>
            <p className="mt-2 text-sm text-slate-600">
              You can request a new link by registering again or by visiting the recovery page.
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <Link to="/register">
                <Button variant="outline">Create account</Button>
              </Link>
              <Link to="/recover">
                <Button>Go to recovery</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
