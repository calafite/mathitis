import type { RichCard } from '@mathitis/schemas';

const TYPE_CONFIG: Record<string, { label: string; icon: string; linkText: string }> = {
  song: { label: 'MÚSICA', icon: '♪', linkText: 'OUVIR NO SPOTIFY' },
  game: { label: 'JOGO', icon: '▣', linkText: 'PÁGINA DA LOJA' },
  film: { label: 'FILME', icon: '▶', linkText: 'VER NO LETTERBOXD' },
  book: { label: 'LIVRO', icon: '📖', linkText: 'VER LIVRO' },
  project: { label: 'PROJETO', icon: '⚙', linkText: 'CÓDIGO ABERTO' },
  custom: { label: 'LINK', icon: '✦', linkText: 'ACESSAR' },
};

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

function CardMetadata({ card, metadata }: { card: RichCard; metadata: Record<string, unknown> }) {
  switch (card.cardType) {
    case 'song':
      return (
        <div className="space-y-1">
          {card.subtitle && (
            <p className="font-mono text-[10px] text-muted-foreground">
              {card.subtitle}
            </p>
          )}
          {typeof metadata.albumName === 'string' && metadata.albumName && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              ÁLBUM · {metadata.albumName}
            </p>
          )}
          {typeof metadata.durationMs === 'number' && metadata.durationMs > 0 && (
            <p className="text-right font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {formatDuration(metadata.durationMs)}
            </p>
          )}
        </div>
      );

    case 'film': {
      const year = metadata.year != null ? String(metadata.year) : null;
      return (
        <div className="space-y-1">
          {(card.subtitle || year) && (
            <p className="font-mono text-[10px] text-muted-foreground">
              DIR: {card.subtitle}{card.subtitle && year ? ` (${year})` : year ? `(${year})` : ''}
            </p>
          )}
          {(typeof metadata.rating === 'number' || typeof metadata.rating === 'string') && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              AVALIAÇÃO: ★ {Number(metadata.rating).toFixed(1)}/10
            </p>
          )}
          {Array.isArray(metadata.genres) && metadata.genres.length > 0 && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {(metadata.genres as string[]).join(', ')}
            </p>
          )}
        </div>
      );
    }

    case 'game':
      return (
        <div className="space-y-1">
          {card.subtitle && (
            <p className="font-mono text-[10px] text-muted-foreground">
              {card.subtitle}
            </p>
          )}
          {Boolean(metadata.steamAppId) && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              STEAM APP ID: {String(metadata.steamAppId)}
            </p>
          )}
          {typeof metadata.platform === 'string' && metadata.platform && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              PLATAFORMA: {String(metadata.platform)}
            </p>
          )}
          {card.description && (
            <p className="line-clamp-2 text-xs leading-relaxed text-foreground/90">
              {card.description}
            </p>
          )}
          {typeof metadata.hoursPlayed === 'number' && metadata.hoursPlayed > 0 && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              TEMPO DE JOGO: {metadata.hoursPlayed}H
            </p>
          )}
        </div>
      );

    case 'project':
      return (
        <div className="space-y-2">
          {card.subtitle && (
            <p className="font-mono text-[10px] text-muted-foreground">
              {card.subtitle}
            </p>
          )}
          {Array.isArray(metadata.techStack) && (metadata.techStack as string[]).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {(metadata.techStack as string[]).slice(0, 3).map((tech) => (
                <span
                  key={tech}
                  className="border border-foreground px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase"
                >
                  {tech}
                </span>
              ))}
              {(metadata.techStack as string[]).length > 3 && (
                <span className="border border-foreground px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase opacity-60">
                  +{(metadata.techStack as string[]).length - 3}
                </span>
              )}
            </div>
          )}
          {typeof metadata.stars === 'number' && metadata.stars > 0 && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              ★ {metadata.stars.toLocaleString()} STARS
            </p>
          )}
          {card.description && (
            <p className="line-clamp-2 text-xs leading-relaxed text-foreground/90">
              {card.description}
            </p>
          )}
        </div>
      );

    case 'book':
      return (
        <div className="space-y-1">
          {card.subtitle && (
            <p className="font-mono text-[10px] text-muted-foreground">
              {card.subtitle}
            </p>
          )}
          {card.description && (
            <p className="line-clamp-3 text-xs leading-relaxed text-foreground/90">
              {card.description}
            </p>
          )}
        </div>
      );

    default:
      return (
        <div className="space-y-1">
          {card.subtitle && (
            <p className="font-mono text-[10px] text-muted-foreground">
              {card.subtitle}
            </p>
          )}
          {card.description && (
            <p className="line-clamp-3 text-xs leading-relaxed text-foreground/90">
              {card.description}
            </p>
          )}
        </div>
      );
  }
}

export function RichCardView({ card, className = '' }: { card: RichCard; className?: string }) {
  const config = TYPE_CONFIG[card.cardType] ?? TYPE_CONFIG.custom!;
  const metadata = (card.metadata ?? {}) as Record<string, unknown>;

  return (
    <article
      className={`group relative flex shrink-0 flex-col border-2 border-foreground bg-card text-foreground snap-start ${className}`}
    >
      {/* 1. Header: Title & Category Badge */}
      <div className="flex items-start justify-between gap-2 border-b-2 border-foreground p-3">
        <h4 className="font-sans text-sm font-bold uppercase leading-tight line-clamp-1">
          {card.title}
        </h4>
        <span
          className="shrink-0 border border-foreground px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-foreground"
          style={{ backgroundColor: card.accentColor || undefined }}
        >
          {config.icon} {config.label}
        </span>
      </div>

      {/* 2. Cover Art (Full-bleed, 160px) */}
      <div className="flex h-40 w-full items-center justify-center overflow-hidden border-b-2 border-foreground bg-muted">
        {card.imageUrl ? (
          <img
            src={card.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            [ SEM IMAGEM ]
          </span>
        )}
      </div>

      {/* 3. Metadata Body */}
      <div className="flex-1 p-3">
        <CardMetadata card={card} metadata={metadata} />
      </div>

      {/* 4. Footer: Contextual CTA Link */}
      {card.externalUrl && (
        <div className="border-t-2 border-foreground p-3">
          <a
            href={card.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-widest underline underline-offset-4 transition-colors hover:bg-foreground hover:text-background"
          >
            {config.linkText} <span aria-hidden>↗</span>
          </a>
        </div>
      )}
    </article>
  );
}
