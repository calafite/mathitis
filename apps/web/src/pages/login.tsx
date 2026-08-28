import { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginBodySchema, type LoginBody } from '@mathitis/schemas';
import { useAuth } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { PasswordInput } from '@/components/ui/password-input';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { usePageMeta } from '@/lib/use-page-meta';
import { ArrowUpRight, Fingerprint, GitBranch, MoveRight } from 'lucide-react';

const CARD_BG = '#d3d7de';

export function LoginPage() {
  usePageMeta(
    'Entrar',
    'Acesse sua conta no Mathitis e continue sua trajetória na linhagem acadêmica.',
  );
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
    <div className="relative min-h-screen overflow-hidden bg-background px-5 py-6 text-foreground sm:px-8 lg:px-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(#c9ced8 1px, transparent 1px), linear-gradient(90deg, #c9ced8 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 80% at 50% 40%, black 30%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 80% at 50% 40%, black 30%, transparent 100%)',
        }}
      />

      <header className="relative mx-auto flex max-w-7xl items-center justify-between">
        <Link to="/login" className="font-mono text-xs font-bold uppercase tracking-[0.3em]">
          Mathitis<span className="text-[#c9f24c]">.</span>
        </Link>
        <p className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground sm:block">
          CACIC · UFPB / 2026
        </p>
      </header>

      <main className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20 lg:py-16">
        <section className="max-w-2xl">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55 }}
            className="mb-8 flex items-center gap-3 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground"
          >
            <span className="h-2 w-2 bg-[#c9f24c]" />
            Portal de apadrinhamento do curso
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="max-w-3xl font-sans text-5xl font-bold uppercase leading-[0.9] tracking-tight sm:text-7xl lg:text-8xl"
          >
            <span className="relative inline-block whitespace-nowrap text-[#c9f24c]">
              apenas comece
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, delay: 0.7, ease: 'easeOut' }}
                className="absolute -bottom-1 left-0 h-1 w-full origin-left bg-[#c9f24c] sm:h-2"
              />
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.3 }}
            className="mt-8 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Bem vindo(a) ao apadrinhamento. Conecte-se com pessoas com as quais contar, faça
            amizades e torne-se parte da linhagem histórica do curso.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.45 }}
            className="mt-12 grid max-w-xl grid-cols-3 border-y border-border py-5"
          >
            <div className="border-r border-border pr-4">
              <Fingerprint className="mb-3 h-5 w-5 text-[#c9f24c]" />
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Identidade
              </p>
              <p className="mt-1 text-sm">Nosso espaço</p>
            </div>
            <div className="border-r border-border px-4">
              <GitBranch className="mb-3 h-5 w-5 text-[#c9f24c]" />
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Linhagem
              </p>
              <p className="mt-1 text-sm">Nossa história</p>
            </div>
            <div className="pl-4">
              <MoveRight className="mb-3 h-5 w-5 text-[#c9f24c]" />
              <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Conexão
              </p>
              <p className="mt-1 text-sm">Seu próximo passo</p>
            </div>
          </motion.div>
        </section>

        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.2 }}
          className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, rotate: -4 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="pointer-events-none absolute -top-20 right-5 z-0 text-7xl leading-none drop-shadow-[4px_4px_0_rgba(201,242,76,0.8)] sm:-top-24 sm:right-10 sm:text-8xl"
            aria-hidden="true"
          >
            🦍
          </motion.div>
          <div
            className="absolute -right-3 -top-3 h-full w-full border-2 border-[#c9f24c]"
            aria-hidden
          />
          <div
            className="auth-card-light relative border-2 border-black p-7 text-[#0b0b0e] sm:p-9"
            style={{ backgroundColor: CARD_BG, boxShadow: '8px 8px 0 0 rgba(201, 206, 216, 0.2)' }}
          >
            <header className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] opacity-60">
                  Acesso restrito
                </p>
                <h2 className="mt-3 font-sans text-3xl font-bold uppercase leading-none tracking-tight">
                  Bem-vindo de volta
                </h2>
              </div>
              <ThemeToggle />
            </header>
            <p className="mt-3 max-w-xs text-sm leading-relaxed opacity-70">
              Continue de onde parou. Estamos esperando.
            </p>

            <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
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
                <PasswordInput
                  id="password"
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
                <div
                  className="border-2 border-[#b3261e] bg-[#b3261e]/10 p-3 text-sm text-[#b3261e]"
                  role="alert"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="group flex w-full items-center justify-center gap-2 border-2 border-black bg-black px-4 py-3 font-mono text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-[#c9f24c] hover:text-black disabled:opacity-50"
                style={{ boxShadow: '4px 4px 0 0 rgba(0,0,0,0.35)' }}
              >
                {isSubmitting ? 'Entrando…' : 'Entrar na rede'}
                {!isSubmitting && (
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between border-t border-black/20 pt-5 font-mono text-[11px] font-bold uppercase tracking-widest">
              <Link
                to="/register"
                className="underline decoration-[#c9f24c] decoration-2 underline-offset-4 hover:no-underline"
              >
                Criar conta
              </Link>
              <Link to="/recover" className="opacity-60 hover:opacity-100">
                Recuperar acesso
              </Link>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
