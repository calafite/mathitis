import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerBodySchema, type RegisterBody } from '@mathitis/schemas';
import { useAuth, type RegisterInput } from '@/contexts/auth-context';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { FieldError, Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { PasswordStrength } from '@/components/ui/password-strength';

export function RegisterPage() {
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
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <header className="mb-6 flex justify-end">
            <ThemeToggle />
          </header>
          <h1 className="text-2xl font-semibold text-foreground">Verifique seu e-mail</h1>
          <p className="mt-2 text-sm text-muted-foreground">
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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
        <header className="mb-6 flex justify-end">
          <ThemeToggle />
        </header>
        <h1 className="text-2xl font-semibold text-foreground">Crie sua conta</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Junte-se ao programa de apadrinhamento e conheça nossos veteranos.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <div>
            <label htmlFor="handle" className="mb-1 block text-sm font-medium text-foreground">
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
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
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
            <label htmlFor="semester" className="mb-1 block text-sm font-medium text-foreground">
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
            <label htmlFor="socialName" className="mb-1 block text-sm font-medium text-foreground">
              Nome Social (opcional)
            </label>
            <Input id="socialName" autoComplete="name" {...field('socialName')} />
            <FieldError message={errors.socialName?.message} />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
              Senha
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...field('password')}
            />
            <FieldError message={errors.password?.message} />
            <PasswordStrength password={password} />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Criando conta…' : 'Criar conta'}
          </Button>
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
