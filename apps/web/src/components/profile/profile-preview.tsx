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
      className="mt-2 w-full rounded-none border-0"
      style={{ height: 152 }}
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
      className="mt-2 inline-block font-mono text-[10px] font-bold uppercase tracking-widest underline underline-offset-4 hover:bg-foreground hover:text-background"
    >
      Código aberto ↗
    </a>
  );
}

function CardContent({ card }: { card: RichCard }) {
  const meta = card.metadata as Record<string, unknown> | null;
  const artistName = meta?.artistName;
  if (card.cardType === 'song' && typeof artistName === 'string' && artistName) {
    return <p className="font-mono text-[10px] uppercase tracking-widest">{artistName}</p>;
  }
  const steamAppId = meta?.steamAppId;
  if (card.cardType === 'game' && typeof steamAppId === 'string') {
    return <p className="font-mono text-[10px] uppercase tracking-widest">Steam · {steamAppId}</p>;
  }
  if (card.cardType === 'film') {
    const rating = meta?.rating;
    if (typeof rating === 'number') {
      return (
        <p className="font-mono text-[10px] uppercase tracking-widest">
          ★ {rating.toFixed(1)}/10
        </p>
      );
    }
  }
  if (card.cardType === 'project' && Array.isArray(meta?.techStack)) {
    const stack = (meta.techStack as unknown[]).slice(0, 4);
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
      </div>
    );
  }
  return null;
}

function RichCardView({ card }: { card: RichCard }) {
  const meta = CARD_META[card.cardType] ?? { label: 'Cartão', icon: '✦' };
  return (
    <article className="flex flex-col rounded-none border border-foreground bg-card p-3">
      {card.imageUrl ? (
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
      {card.description ? <p className="mt-1 text-xs text-foreground">{card.description}</p> : null}
      <CardContent card={card} />
      <CardEmbed card={card} />
      <CardLink card={card} />
    </article>
  );
}

function SectionHeader({ children }: { children: string }) {
  return (
    <h3 className="py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
      {children}
    </h3>
  );
}

export function ProfilePreview({ draft, avatarUrl, bannerUrl, bannerPreset, cards, effortScore }: ProfilePreviewProps) {
  const theme = draft.themePalette;
  const cssVars = {
    '--profile-primary': theme.primaryColor,
    '--profile-accent': theme.accentColor,
    '--profile-badge': theme.badgeColor,
  } as CSSProperties;

  const linkFields: Array<{ label: string; href: string }> = [];
  if (draft.socialLinks.github) linkFields.push({ label: 'GitHub', href: draft.socialLinks.github });
  if (draft.socialLinks.linkedin) linkFields.push({ label: 'LinkedIn', href: draft.socialLinks.linkedin });
  if (draft.socialLinks.discord) linkFields.push({ label: 'Discord', href: draft.socialLinks.discord });
  if (draft.socialLinks.website) linkFields.push({ label: 'Site', href: draft.socialLinks.website });
  if (draft.contactEmail) linkFields.push({ label: 'Email', href: `mailto:${draft.contactEmail}` });

  return (
    <div className="rounded-none border-2 border-foreground" style={cssVars}>
      {/* Banner */}
      <div
        className="relative h-28 border-b border-foreground/50"
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
          <span className="absolute bottom-2 right-3 font-mono text-[10px] uppercase tracking-widest text-white">
            {bannerPreset}
          </span>
        ) : null}
      </div>

      {/* Header */}
      <div className="flex items-end justify-between border-b border-foreground/50 px-4 pb-3">
        <div className="flex items-end gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Pré-visualização do avatar"
              className="-mt-10 h-20 w-20 rounded-full border-2 border-foreground bg-background object-cover"
            />
          ) : (
            <div
              className="-mt-10 flex h-20 w-20 items-center justify-center rounded-full border-2 border-foreground bg-background font-sans text-3xl font-bold text-foreground"
            >
              {(draft.socialName || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="pb-1">
            <h2 className="font-sans text-2xl font-bold uppercase leading-tight text-foreground">
              {draft.socialName || 'Seu nome'}
            </h2>
            {draft.pronouns ? (
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {draft.pronouns}
              </p>
            ) : null}
          </div>
        </div>
        <span
          className={`mb-1 shrink-0 rounded-none px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest ${
            draft.isAcceptingRequests
              ? 'bg-primary text-primary-foreground'
              : 'border border-foreground text-muted-foreground'
          }`}
        >
          {draft.isAcceptingRequests ? 'Aceitando ferinhas' : 'Capacidade cheia'}
        </span>
      </div>

      {/* Tagline */}
      {draft.tagline ? (
        <div className="border-b border-foreground/50 px-4 py-2">
          <p className="font-mono text-xs italic uppercase text-foreground">{draft.tagline}</p>
        </div>
      ) : null}

      {/* Biography */}
      {draft.biographyMarkdown ? (
        <div className="border-b border-foreground/50 px-4 pb-3">
          <SectionHeader>Biografia</SectionHeader>
          <MarkdownPreview markdown={draft.biographyMarkdown} />
        </div>
      ) : null}

      {/* Links */}
      {linkFields.length > 0 ? (
        <div className="border-b border-foreground/50 px-4 pb-3">
          <SectionHeader>Contato</SectionHeader>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {linkFields.map((field) => (
              <a
                key={field.label}
                href={field.href}
                target={field.href.startsWith('mailto:') ? undefined : '_blank'}
                rel="noopener noreferrer"
                className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground underline underline-offset-4 hover:bg-foreground hover:text-background"
              >
                {field.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {/* Cards */}
      <div className={`px-4 ${cards.length > 0 ? 'pb-4' : ''}`}>
        {cards.length > 0 ? (
          <>
            <SectionHeader>Coleção</SectionHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cards.map((card) => (
                <RichCardView key={card.id} card={card} />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {/* Footer stats */}
      <div className="flex justify-between border-t border-foreground py-1 pl-2 pr-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
        <span>Até {draft.maxMentees} ferinhas</span>
        <span>Pontuação de esforço {effortScore}</span>
      </div>
    </div>
  );
}
