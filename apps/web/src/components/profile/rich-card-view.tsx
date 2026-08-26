import type { RichCard } from '@mathitis/schemas';

const TYPE_CONFIG: Record<string, { label: string; icon: string; linkText: string }> = {
  song: { label: 'MÚSICA', icon: '♪', linkText: 'OUVIR NO SPOTIFY' },
  game: { label: 'JOGO', icon: '▣', linkText: 'PÁGINA DA LOJA' },
  film: { label: 'FILME', icon: '▶', linkText: 'VER NO LETTERBOXD' },
  book: { label: 'LIVRO', icon: '📖', linkText: 'VER LIVRO' },
  project: { label: 'PROJETO', icon: '⚙', linkText: 'CÓDIGO ABERTO' },
  custom: { label: 'LINK', icon: '✦', linkText: 'ACESSAR' },
};

export function RichCardView({ card }: { card: RichCard }) {
  const config = TYPE_CONFIG[card.cardType] ?? TYPE_CONFIG.custom!;
  const isSpotify = card.cardType === 'song' && Boolean(card.embedUrl);
  const metadata = (card.metadata ?? {}) as Record<string, unknown>;

  return (
    <article
      className="group relative flex w-72 shrink-0 flex-col justify-between border-2 border-foreground bg-card text-foreground snap-start"
      style={{ minHeight: '320px' }}
    >
      {/* Header: Title & Category Badge */}
      <div className="flex items-start justify-between gap-2 border-b border-foreground/30 p-3">
        <h4 className="font-sans text-sm font-bold uppercase leading-tight line-clamp-1">
          {card.title}
        </h4>
        <span className="shrink-0 border border-foreground/40 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
          {config.icon} {config.label}
        </span>
      </div>

      {/* Media & Body Content */}
      <div className="flex flex-1 flex-col justify-center">
        {isSpotify && card.embedUrl ? (
          <div className="bg-black p-2">
            <iframe
              src={card.embedUrl}
              title={card.title}
              width="100%"
              height="152"
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              style={{
                colorScheme: 'dark',
                backgroundColor: 'transparent',
                border: 0,
              }}
            />
          </div>
        ) : (
          <>
            {card.imageUrl && (
              <div className="h-32 w-full overflow-hidden border-b border-foreground/30 bg-muted">
                <img
                  src={card.imageUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
            )}

            <div className="space-y-2 p-3">
              {card.subtitle && (
                <p className="line-clamp-1 font-mono text-xs font-semibold text-muted-foreground">
                  {card.subtitle}
                </p>
              )}
              {card.description && (
                <p className="line-clamp-3 text-xs leading-relaxed text-foreground/90">
                  {card.description}
                </p>
              )}

              {card.cardType === 'game' && Boolean(metadata.steamAppId) && (
                <p className="font-mono text-[10px] uppercase text-muted-foreground">
                  STEAM · {String(metadata.steamAppId)}
                </p>
              )}
              {card.cardType === 'film' && Boolean(metadata.year) && (
                <p className="font-mono text-[10px] uppercase text-muted-foreground">
                  LANÇAMENTO · {String(metadata.year)}
                </p>
              )}
              {card.cardType === 'project' && Array.isArray(metadata.techStack) && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {(metadata.techStack as string[]).slice(0, 3).map((tech) => (
                    <span
                      key={tech}
                      className="border border-foreground/30 px-1 py-0.5 font-mono text-[8px] font-bold uppercase"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Context-Aware Footer Link */}
      {card.externalUrl && (
        <div className="border-t border-foreground/30 bg-muted/20 p-2.5">
          <a
            href={card.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-widest underline underline-offset-4 transition-colors hover:text-primary"
          >
            {config.linkText} <span aria-hidden>↗</span>
          </a>
        </div>
      )}
    </article>
  );
}
