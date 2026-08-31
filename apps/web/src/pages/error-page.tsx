import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, RefreshCw } from 'lucide-react';
import { ApiError } from '@/lib/api';
import { usePageMeta } from '@/lib/use-page-meta';

export interface ErrorPageProps {
  error?: unknown;
  title?: string;
  message?: string;
  onRetry?: () => void;
}

function extractDetails(error: unknown): Record<string, unknown> {
  if (error instanceof ApiError) {
    return {
      statusCode: error.status,
      code: error.code,
      message: error.message,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 6),
    };
  }
  return { raw: String(error ?? 'unknown') };
}

export function ErrorPage({ error, title, message, onRetry }: ErrorPageProps) {
  usePageMeta(title ?? 'Algo deu errado');
  const [copied, setCopied] = useState(false);

  const details = extractDetails(error);
  const detailText = JSON.stringify(details, null, 2);
  const heading = title ?? 'Algo deu errado';
  const body =
    message ??
    (error instanceof ApiError ? error.message : 'Ocorreu um erro inesperado no servidor.');

  async function copyError() {
    try {
      await navigator.clipboard.writeText(detailText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable; silently ignore.
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <svg
        viewBox="0 0 220 120"
        className="h-auto w-56"
        role="img"
        aria-label="Aresta quebrada na árvore de linhagem"
      >
        <path
          d="M 15 100 C 55 96, 75 84, 95 64 C 110 49, 125 42, 140 38"
          fill="none"
          stroke="var(--color-lineage)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M 152 36 L 205 32"
          fill="none"
          stroke="var(--color-foreground)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="10 8"
        />
        <circle cx="15" cy="100" r="5" fill="var(--color-lineage)" />
        <circle
          cx="95"
          cy="64"
          r="4"
          fill="none"
          stroke="var(--color-foreground)"
          strokeWidth="1.5"
        />
        {/* fracture marks */}
        <path
          d="M 143 30 L 149 44 M 150 29 L 156 43"
          stroke="var(--color-destructive)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <text
          x="150"
          y="70"
          fontSize="11"
          fontFamily="monospace"
          fill="var(--color-muted-foreground)"
        >
          ERR://edge_broken 🐈‍⬛
        </text>
      </svg>

      <div className="w-full max-w-xl space-y-2">
        <h1 className="border-b border-foreground pb-2 text-left font-display text-4xl font-semibold uppercase tracking-tight">
          {heading}
        </h1>
        <p className="max-w-md text-left font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {body}
        </p>

        <details className="mt-4 border border-foreground/30 bg-card p-3 text-left font-mono text-xs">
          <summary className="cursor-pointer font-bold uppercase tracking-widest text-primary">
            [+] Detalhes técnicos do erro (API)
          </summary>
          <pre className="mt-2 overflow-x-auto text-left text-[11px] leading-relaxed text-foreground/80">
            {detailText}
          </pre>
        </details>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-none border border-foreground px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao início
        </Link>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-none border border-foreground bg-transparent px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Tentar novamente
          </button>
        ) : null}
        <button
          type="button"
          onClick={copyError}
          className="inline-flex items-center gap-2 rounded-none border border-foreground bg-transparent px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background"
          aria-live="polite"
        >
          <Copy className="h-4 w-4" aria-hidden />
          {copied ? 'Copiado ✓' : 'Copiar erro'}
        </button>
      </div>
    </div>
  );
}
