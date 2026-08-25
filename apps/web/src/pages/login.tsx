import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginBodySchema, type LoginBody } from '@mathitis/schemas';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { usePageMeta } from '@/lib/use-page-meta';

const CARD_BG = '#d3d7de';
const INK = '#0b0b0e';

export function LoginPage() {
  usePageMeta('Entrar', 'Acesse sua conta no Mathitis e continue sua trajetória na linhagem acadêmica.');
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

  const labelCls = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest';
  const inputCls =
    'h-10 w-full border-2 border-black bg-white px-3 text-sm text-black placeholder:text-black/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9f24c]';

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Blueprint grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(#c9ced8 1px, transparent 1px), linear-gradient(90deg, #c9ced8 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 40%, black 30%, transparent 100%)',
        }}
      />

      <div
        className="relative w-full max-w-md border-2 border-black p-8"
        style={{
          backgroundColor: CARD_BG,
          color: INK,
          boxShadow: '10px 10px 0 0 rgba(201, 206, 216, 0.18)',
        }}
      >
        <header className="-mb-2 flex items-start justify-between">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] opacity-60">
            Portal de apadrinhamento
          </p>
          <ThemeToggle />
        </header>

        <h1 className="mt-4 font-sans text-3xl font-bold uppercase leading-none tracking-tight">
          Mathitis
        </h1>
        <p className="mt-2 text-sm opacity-80">
          Encontre seu padrinho na Ciência da Computação e entre para a linhagem.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="identifier" className={labelCls}>
              Nome ou email
            </label>
            <input
              id="identifier"
              autoComplete="username"
              className={inputCls}
              {...register('identifier')}
            />
            {errors.identifier?.message && (
              <p className="mt-1 text-sm text-[#b3261e]" role="alert">
                {errors.identifier.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className={labelCls}>
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className={inputCls}
              {...register('password')}
            />
            {errors.password?.message && (
              <p className="mt-1 text-sm text-[#b3261e]" role="alert">
                {errors.password.message}
              </p>
            )}
          </div>

          {error && (
            <div className="border-2 border-[#b3261e] bg-[#b3261e]/10 p-3 text-sm text-[#b3261e]" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full border-2 border-black bg-black px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#c9f24c] hover:text-black disabled:opacity-50"
            style={{ boxShadow: '4px 4px 0 0 rgba(0,0,0,0.35)' }}
          >
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between font-mono text-[11px] font-bold uppercase tracking-widest">
          <Link to="/register" className="underline hover:no-underline">
            Criar conta
          </Link>
          <Link to="/recover" className="opacity-70 hover:opacity-100">
            Esqueceu a senha?
          </Link>
        </div>
      </div>
    </div>
  );
}
