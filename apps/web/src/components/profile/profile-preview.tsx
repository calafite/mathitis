import type { CSSProperties } from 'react';
import type { RichCard, ThemePalette } from '@mathitis/schemas';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';

export interface ProfileDraft {
  socialName: string;
  pronouns: string;
  tagline: string;
  biographyMarkdown: string;
  themePalette: ThemePalette;
  contactEmail: string;
  socialLinks: {
    github?: string;
    discord?: string;
    linkedin?: string;
    website?: string;
  };
  maxMentees: number;
  isAcceptingRequests: boolean;
  isDiscoverable: boolean;
}

export interface ProfilePreviewProps {
  draft: ProfileDraft;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerPreset?: string | null;
  cards: RichCard[];
  effortScore: number;
}

const CARD_META: Record<string, { label: string; icon: string }> = {
  song: { label: 'Música', icon: '♪' },
  game: { label: 'Jogo', icon: '▣' },
  film: { label: 'Filme', icon: '▶' },
  book: { label: 'Livro', icon: '📖' },
  project: { label: 'Projeto', icon: '⚙' },
  custom: { label: 'Cartão', icon: '✦' },
};

function CardEmbed({ card }: { card: RichCard }) {
  if (!card.embedUrl) return null;
  return (
    <iframe
      src={card.embedUrl}
      title={card.title}
      loading="lazy"
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
      className="mt-2 aspect-video w-full rounded-md border-0"
    />
  );
}

function CardLink({ card }: { card: RichCard }) {
  if (!card.externalUrl) return null;
  return (
    <a
      href={card.externalUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 inline-block text-xs font-medium underline"
    >
      Código aberto
    </a>
  );
}

function CardContent({ card }: { card: RichCard }) {
  const meta = card.metadata as Record<string, unknown> | null;
  const artistName = meta?.artistName;
  if (card.cardType === 'song' && typeof artistName === 'string' && artistName) {
    return <p className="text-xs text-muted-foreground">{artistName}</p>;
  }
  const steamAppId = meta?.steamAppId;
  if (card.cardType === 'game' && typeof steamAppId === 'string') {
    return <p className="text-xs text-muted-foreground">App Steam {steamAppId}</p>;
  }
  if (card.cardType === 'film') {
    const rating = meta?.rating;
    if (typeof rating === 'number') {
      return <p className="text-xs text-muted-foreground">Avaliação {rating.toFixed(1)}/10</p>;
    }
  }
  if (card.cardType === 'project' && Array.isArray(meta?.techStack)) {
    const stack = (meta.techStack as unknown[]).slice(0, 4);
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {stack.map((item) => (
          <span key={String(item)} className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white" style={{ background: 'var(--profile-badge, #3b82f6)' }}>
            {String(item)}
          </span>
        ))}
      </div>
    );
  }
  return null;
}

function RichCardView({ card }: { card: RichCard }) {
  const meta = CARD_META[card.cardType] ?? { label: 'Cartão', icon: '✦' };
  const styleVar = { '--profile-card-accent': card.accentColor } as CSSProperties;
  return (
    <article
      className="profile-card flex flex-col rounded-xl border border-border bg-card p-4 shadow-sm"
      style={styleVar}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
        <span className="text-base text-muted-foreground" aria-hidden>
          {meta.icon}
        </span>
      </div>
      {card.subtitle ? <p className="text-xs text-muted-foreground">{card.subtitle}</p> : null}
      {card.description ? <p className="mt-1 text-xs text-foreground/80">{card.description}</p> : null}
      <CardContent card={card} />
      <CardEmbed card={card} />
      <CardLink card={card} />
    </article>
  );
}

export function ProfilePreview({ draft, avatarUrl, bannerUrl, bannerPreset, cards, effortScore }: ProfilePreviewProps) {
  const theme = draft.themePalette;
  const cssVars = {
    '--profile-primary': theme.primaryColor,
    '--profile-accent': theme.accentColor,
    '--profile-badge': theme.badgeColor,
    '--profile-card-bg':
      theme.cardStyle === 'glassmorphic'
        ? 'rgba(255, 255, 255, 0.65)'
        : theme.cardStyle === 'solid'
          ? 'rgba(255, 255, 255, 0.98)'
          : 'transparent',
  } as CSSProperties;

  const cardClass =
    theme.cardStyle === 'glassmorphic'
      ? 'backdrop-blur-md bg-card/60 border-border/40'
      : theme.cardStyle === 'solid'
        ? 'bg-card'
        : 'bg-transparent border-2';

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border shadow-sm"
      style={cssVars}
    >
      <div
        className="relative h-28 bg-gradient-to-r"
        style={{
          backgroundImage: bannerUrl
            ? `url(${bannerUrl})`
            : bannerPreset === 'gradient_cosmic'
              ? 'linear-gradient(135deg, #6366f1, #ec4899)'
              : `linear-gradient(135deg, ${theme.primaryColor}, ${theme.accentColor})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {bannerPreset && !bannerUrl ? (
          <span className="absolute bottom-2 right-3 text-xs font-medium text-white/80">
            {bannerPreset}
          </span>
        ) : null}
      </div>

      <div className={`px-6 pb-6 pt-4 ${cardClass}`}>
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-3">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Pré-visualização do avatar" className="h-16 w-16 -mt-8 rounded-full border-4 border-card object-cover shadow" />
            ) : (
              <div className="flex h-16 w-16 -mt-8 items-center justify-center rounded-full border-4 border-card text-2xl font-bold text-white shadow" style={{ background: theme.primaryColor }}>
                {(draft.socialName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-foreground">{draft.socialName || 'Seu nome'}</h2>
              {draft.pronouns ? <p className="text-xs text-muted-foreground">{draft.pronouns}</p> : null}
            </div>
          </div>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
            style={{ background: draft.isAcceptingRequests ? '#16a34a' : '#64748b' }}
          >
            {draft.isAcceptingRequests ? 'Aceitando ferinhas' : 'Capacidade cheia'}
          </span>
        </div>

        {draft.tagline ? <p className="mt-3 text-sm text-foreground/80">{draft.tagline}</p> : null}

        <div className="mt-4">
          <MarkdownPreview markdown={draft.biographyMarkdown} />
        </div>

        {draft.socialLinks.github || draft.socialLinks.linkedin || draft.contactEmail ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {draft.socialLinks.github ? (
              <a href={draft.socialLinks.github} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                GitHub
              </a>
            ) : null}
            {draft.socialLinks.linkedin ? (
              <a href={draft.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                LinkedIn
              </a>
            ) : null}
            {draft.contactEmail ? <span className="text-foreground/80">{draft.contactEmail}</span> : null}
          </div>
        ) : null}

        {cards.length > 0 ? (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cards.map((card) => (
              <RichCardView key={card.id} card={card} />
            ))}
          </div>
        ) : (
          <p className="mt-5 text-xs text-muted-foreground">Adicione cartões ricos para exibir músicas, jogos, filmes ou projetos.</p>
        )}

        <div className="mt-5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Até {draft.maxMentees} ferinhas</span>
          <span>Pontuação de esforço {effortScore}</span>
        </div>
      </div>
    </div>
  );
}
