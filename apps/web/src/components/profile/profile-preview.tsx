import type { CSSProperties } from 'react';
import type { RichCard, ThemePalette } from '@mathitis/schemas';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';
import { CardRail, CardRailItem } from './rich-card-shared';

export interface ProfileDraftTag {
  id: string;
  name: string;
  category: string;
  color: string;
  icon?: string | null;
}

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
  tags: ProfileDraftTag[];
}

export interface ProfilePreviewProps {
  draft: ProfileDraft;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bannerPreset?: string | null;
  cards: RichCard[];
  effortScore: number;
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
      <div className="relative z-10 flex items-end justify-between border-b border-foreground/50 px-4 pb-3">
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

      {/* Tag badges */}
      {draft.tags.length > 0 ? (
        <div className="border-b border-foreground/50 px-4 py-2">
          <div className="flex flex-wrap gap-1">
            {draft.tags.map((tag) => (
              <span
                key={tag.id}
                className="border border-foreground px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-foreground"
              >
                {tag.icon ? `${tag.icon} ` : ''}
                {tag.name}
              </span>
            ))}
          </div>
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
            <CardRail>
              {cards.map((card) => (
                <CardRailItem key={card.id} card={card} />
              ))}
            </CardRail>
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
