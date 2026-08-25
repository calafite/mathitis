import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerBodySchema, type RegisterBody } from '@mathitis/schemas';
import { useAuth, type RegisterInput } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { PasswordStrength } from '@/components/ui/password-strength';
import { usePageMeta } from '@/lib/use-page-meta';

export function RegisterPage() {
  usePageMeta('Criar conta', 'Junte-se ao programa de apadrinhamento acadêmico.');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register: field,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterBody>({
    resolver: zodResolver(registerBodySchema),
    defaultValues: { handle: '', email: '', password: '', semester: 1 },
  });

  const password = watch('password');

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const input: RegisterInput = {
      handle: values.handle,
      email: values.email,
      password: values.password,
      semester: values.semester,
      socialName: values.socialName,
    };
    try {
      await register(input);
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Não foi possível completar o registro. Tente novamente mais tarde.');
      }
    }
  });

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="auth-card-light w-full max-w-md border-2 border-black bg-[#d3d7de] p-8 text-center text-[#0b0b0e]" style={{ boxShadow: '10px 10px 0 0 rgba(201, 206, 216, 0.18)' }}>
          <header className="mb-6 flex justify-end">
            <ThemeToggle />
          </header>
          <h1 className="font-sans text-2xl font-bold uppercase tracking-tight">Verifique seu e-mail</h1>
          <p className="mt-2 text-sm opacity-80">
            Se o e-mail informado for válido, você receberá uma mensagem de confirmação
            em breve. Clique no link da mensagem para verificar sua conta. Lembre-se de checar o spam!
          </p>
          <Button className="mt-6" onClick={() => navigate('/login')}>
            Voltar para o login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-8">
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
        className="auth-card-light relative w-full max-w-md border-2 border-black bg-[#d3d7de] p-8 text-[#0b0b0e]"
        style={{ boxShadow: '10px 10px 0 0 rgba(201, 206, 216, 0.18)' }}
      >
        <header className="-mb-2 flex items-start justify-end">
          <ThemeToggle />
        </header>
        <h1 className="mt-4 font-sans text-2xl font-bold uppercase leading-none tracking-tight">Crie sua conta</h1>
        <p className="mt-2 text-sm opacity-80">
          Junte-se ao programa de apadrinhamento de Ciência da Computação.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <div>
            <label htmlFor="handle" className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest">
              Nome de usuário
            </label>
            <Input
              id="handle"
              autoComplete="username"
              placeholder="nycolas"
              {...field('handle')}
            />
            <FieldError message={errors.handle?.message} />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest">
              Email Acadêmico
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="nycodemon@academico.ufpb.br"
              {...field('email')}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div>
            <label htmlFor="semester" className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest">
              Período
            </label>
            <Input
              id="semester"
              type="number"
              min={1}
              max={12}
              {...field('semester', { valueAsNumber: true })}
            />
            <FieldError message={errors.semester?.message} />
          </div>

          <div>
            <label htmlFor="socialName" className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest">
              Nome Social (opcional)
            </label>
            <Input id="socialName" autoComplete="name" {...field('socialName')} />
            <FieldError message={errors.socialName?.message} />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest">
              Senha
            </label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              {...field('password')}
            />
            <FieldError message={errors.password?.message} />
            <PasswordStrength password={password} />
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
            {isSubmitting ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Já possui uma conta?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
