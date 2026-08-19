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

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterBody>({
    resolver: zodResolver(registerBodySchema),
    defaultValues: { handle: '', email: '', password: '', semester: 1 },
  });

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
        setError('Unable to register. Please try again.');
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
          <h1 className="text-2xl font-semibold text-foreground">Check your inbox</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            If an account with that information exists, you will receive a verification email
            shortly. Follow the link in the email to activate your account.
          </p>
          <Button className="mt-6" onClick={() => navigate('/login')}>
            Back to sign in
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
        <h1 className="text-2xl font-semibold text-foreground">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Join as a freshman and discover mentors in the mathematics department.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="handle" className="mb-1 block text-sm font-medium text-foreground">
              Handle
            </label>
            <Input
              id="handle"
              autoComplete="username"
              placeholder="ada_math"
              {...field('handle')}
            />
            <FieldError message={errors.handle?.message} />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-foreground">
              University email
            </label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@cs.uni.edu"
              {...field('email')}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div>
            <label htmlFor="semester" className="mb-1 block text-sm font-medium text-foreground">
              Semester
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
              Preferred name (optional)
            </label>
            <Input id="socialName" autoComplete="name" {...field('socialName')} />
            <FieldError message={errors.socialName?.message} />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-foreground">
              Password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...field('password')}
            />
            <FieldError message={errors.password?.message} />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
