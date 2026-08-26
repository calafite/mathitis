import { useRef, type ReactNode } from 'react';
import type { RichCard } from '@mathitis/schemas';

const CARD_META: Record<string, { label: string; icon: string }> = {
  song: { label: 'Música', icon: '♪' },
  game: { label: 'Jogo', icon: '▣' },
  film: { label: 'Filme', icon: '▶' },
  book: { label: 'Livro', icon: '📖' },
  project: { label: 'Projeto', icon: '⚙' },
  custom: { label: 'Cartão', icon: '✦' },
};

const CARD_LINK_LABELS: Record<string, string> = {
  song: 'Ouvir',
  game: 'Página na loja',
  film: 'Ver no Letterboxd',
  book: 'Ver na OpenLibrary',
  project: 'Código aberto',
  custom: 'Abrir link',
};

function cardLinkLabel(cardType: string): string {
  return CARD_LINK_LABELS[cardType] ?? 'Abrir link';
}

function CardEmbed({ card }: { card: RichCard }) {
  if (!card.embedUrl) return null;
  const isSpotify = card.embedUrl.includes('open.spotify.com');
  const isFullPlayer = isSpotify && /\/embed\/(show|playlist|artist)\//.test(card.embedUrl);
  const height = !isSpotify ? undefined : isFullPlayer ? 352 : 152;
  return (
    <div className="mt-2 overflow-hidden rounded-none bg-black">
      <iframe
        src={card.embedUrl}
        title={card.title}
        loading="lazy"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        className="block w-full border-0"
        style={height ? { height } : { aspectRatio: '16 / 9' }}
      />
    </div>
  );
}

function CardLink({ card }: { card: RichCard }) {
  if (!card.externalUrl) return null;
  return (
    <a
      href={card.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-block font-mono text-[10px] font-bold uppercase tracking-widest underline underline-offset-4 hover:bg-foreground hover:text-background"
    >
      {cardLinkLabel(card.cardType)} ↗
    </a>
  );
}

function CardContent({ card }: { card: RichCard }) {
  const meta = card.metadata as Record<string, unknown> | null;
  const artistName = meta?.artistName;
  if (card.cardType === 'song' && typeof artistName === 'string' && artistName) {
    return <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{artistName}</p>;
  }
  const steamAppId = meta?.steamAppId;
  if (card.cardType === 'game' && typeof steamAppId === 'string') {
    return <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Steam · {steamAppId}</p>;
  }
  if (card.cardType === 'film') {
    const rating = meta?.rating;
    if (typeof rating === 'number' || typeof rating === 'string') {
      const value = Number(rating);
      if (Number.isFinite(value)) {
        return (
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            ★ {value.toFixed(1)}/10
          </p>
        );
      }
    }
  }
  if (card.cardType === 'project' && Array.isArray(meta?.techStack)) {
    const stack = (meta.techStack as unknown[]).slice(0, 4);
    const extra = (meta.techStack as unknown[]).length - stack.length;
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {stack.map((item) => (
          <span
            key={String(item)}
            className="border border-foreground px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase"
          >
            {String(item)}
          </span>
        ))}
        {extra > 0 && (
          <span className="border border-foreground px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase opacity-60">
            +{extra}
          </span>
        )}
      </div>
    );
  }
  return null;
}

export function RichCardView({ card }: { card: RichCard }) {
  const meta = CARD_META[card.cardType] ?? { label: 'Cartão', icon: '✦' };
  const isSpotifySong = card.cardType === 'song' && card.embedUrl?.includes('open.spotify.com');
  return (
    <article
      className="flex h-full flex-col border border-foreground p-3"
      style={{
        clipPath: 'polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px))',
      }}
    >
      {card.imageUrl && !isSpotifySong ? (
        <img
          src={card.imageUrl}
          alt=""
          loading="lazy"
          className="-mx-3 -mt-3 mb-2 h-32 w-[calc(100%+1.5rem)] object-cover border-b border-foreground"
        />
      ) : null}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold leading-tight text-foreground">{card.title}</h3>
        <span
          className="shrink-0 border border-foreground px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest"
          aria-label={meta.label}
        >
          {meta.icon} {meta.label}
        </span>
      </div>
      {card.subtitle ? (
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {card.subtitle}
        </p>
      ) : null}
      {card.description ? <p className="mt-1 line-clamp-4 text-xs text-foreground">{card.description}</p> : null}
      <CardContent card={card} />
      <div className="mt-auto">
        <CardEmbed card={card} />
        <CardLink card={card} />
      </div>
    </article>
  );
}

/**
 * Horizontal snap carousel for showcase cards: smooth overflow rail with
 * fixed-width cards and ‹ › navigation arrows.
 */
export function CardRail({ children }: { children: ReactNode }) {
  const railRef = useRef<HTMLDivElement>(null);

  function scrollByCards(direction: 1 | -1) {
    const rail = railRef.current;
    if (!rail) return;
    const firstChild = rail.firstElementChild as HTMLElement | null;
    const step = (firstChild?.offsetWidth ?? 320) + 16;
    rail.scrollBy({ left: direction * step, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div className="mb-1 flex justify-end gap-1">
        <button
          type="button"
          aria-label="Rolar para a esquerda"
          onClick={() => scrollByCards(-1)}
          className="border border-foreground px-2 py-0.5 font-mono text-sm leading-none transition-colors hover:bg-foreground hover:text-background"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label="Rolar para a direita"
          onClick={() => scrollByCards(1)}
          className="border border-foreground px-2 py-0.5 font-mono text-sm leading-none transition-colors hover:bg-foreground hover:text-background"
        >
          ›
        </button>
      </div>
      <div
        ref={railRef}
        data-testid="card-rail"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:h-1 [&::-webkit-scrollbar-thumb]:bg-foreground/30 [&::-webkit-scrollbar-thumb]:hover:bg-foreground/50 [&::-webkit-scrollbar-track]:bg-transparent"
      >
        {children}
      </div>
    </div>
  );
}

/** Fixed-width snap slot so every card aligns on the rail. */
export function CardRailItem({ card }: { card: RichCard }) {
  return (
    <div className="w-72 shrink-0 snap-start sm:w-80">
      <RichCardView card={card} />
    </div>
  );
}
