import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { usePageMeta } from '@/lib/use-page-meta';

export function NotFoundPage() {
  usePageMeta('Página não encontrada');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <svg
        viewBox="0 0 200 120"
        className="h-auto w-56"
        role="img"
        aria-label="Ramificação solta da árvore de linhagem"
      >
        <path
          d="M 20 100 C 60 96, 80 84, 100 64 C 118 46, 140 38, 180 32"
          fill="none"
          stroke="var(--color-lineage)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M 100 64 C 108 50, 110 40, 108 26"
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          strokeLinecap="round"
        />
        <circle cx="20" cy="100" r="5" fill="var(--color-lineage)" />
        <circle
          cx="108"
          cy="22"
          r="4"
          fill="none"
          stroke="var(--color-muted-foreground)"
          strokeDasharray="3 2"
        />
      </svg>

      <div className="space-y-2">
        <h1 className="font-display text-5xl font-semibold">404</h1>
        <p className="font-display text-xl">🐈‍⬛ Este galho não existe na árvore.</p>
        <p className="max-w-md text-sm text-muted-foreground">
          A página que você procura foi movida, renomeada ou nunca foi plantada.
        </p>
      </div>

      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao início
      </Link>
    </div>
  );
}
