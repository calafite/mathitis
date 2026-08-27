'use client';

import { useMemo } from 'react';

interface PasswordStrengthProps {
  password: string;
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const checks = useMemo(() => {
    const hasLength = password.length >= 8 && password.length <= 128;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    return [
      { label: '8–128 caracteres', met: hasLength },
      { label: 'Letra maiúscula', met: hasUpper },
      { label: 'Letra minúscula', met: hasLower },
      { label: 'Digito alfanumérico', met: hasNumber },
      { label: 'Caractere especial (opcional)', met: hasSpecial },
    ];
  }, [password]);

  const metCount = checks.filter((c) => c.met).length;
  const requiredMet = checks.slice(0, 4).every((c) => c.met);

  let strength = 0;
  let label = 'Péssima';
  let color = 'bg-red-500';
  if (metCount >= 5) {
    strength = 100;
    label = 'Forte';
    color = 'bg-emerald-500';
  } else if (metCount >= 4) {
    strength = 80;
    label = 'Boa';
    color = 'bg-emerald-400';
  } else if (metCount >= 3) {
    strength = 60;
    label = 'Mediana';
    color = 'bg-amber-500';
  } else if (metCount >= 2) {
    strength = 40;
    label = 'Fraca';
    color = 'bg-orange-500';
  } else if (metCount >= 1) {
    strength = 20;
    label = 'Muito fraca';
    color = 'bg-red-500';
  }

  if (password.length === 0) {
    strength = 0;
    label = '';
    color = 'bg-slate-200 dark:bg-slate-700';
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Complexidade da Senha</span>
        <span
          className={`font-medium ${requiredMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}
        >
          {label}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700">
        <div
          className={`h-full transition-all duration-300 ${color}`}
          style={{ width: `${strength}%` }}
        />
      </div>
      <ul className="grid grid-cols-2 gap-1 text-[11px] text-muted-foreground">
        {checks.map((check, i) => (
          <li
            key={i}
            className={`flex items-center gap-1.5 ${check.met ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
          >
            <span className="flex h-3.5 w-3.5 items-center justify-center rounded">
              {check.met ? (
                <svg
                  className="h-2.5 w-2.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg
                  className="h-2.5 w-2.5"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </span>
            <span>{check.label}</span>
          </li>
        ))}
      </ul>
      {!requiredMet && password.length > 0 && (
        <p className="text-xs text-destructive">
          A senha deve cumprir os quatro primeiros requisitos.
        </p>
      )}
    </div>
  );
}
