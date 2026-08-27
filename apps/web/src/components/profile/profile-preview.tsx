import { useState, useCallback, useMemo, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { RichCard, RichCardType, ThemePalette } from '@mathitis/schemas';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';
import { RichCardView } from './rich-card-view';
import { CARD_TYPE_LABELS, groupCardsByType } from './rich-card-catalog';

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

export function ProfilePreview({
  draft,
  avatarUrl,
  bannerUrl,
  bannerPreset,
  cards,
  effortScore,
}: ProfilePreviewProps) {
  const theme = draft.themePalette;
  const cssVars = {
    '--profile-primary': theme.primaryColor,
    '--profile-accent': theme.accentColor,
    '--profile-badge': theme.badgeColor,
  } as CSSProperties;

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState(false);

  const groupedCards = useMemo(() => groupCardsByType(cards), [cards]);

  const linkFields: Array<{ label: string; href?: string; copyValue?: string }> = [];
  if (draft.socialLinks.github)
    linkFields.push({ label: 'GitHub', href: draft.socialLinks.github });
  if (draft.socialLinks.linkedin)
    linkFields.push({ label: 'LinkedIn', href: draft.socialLinks.linkedin });
  if (draft.socialLinks.discord)
    linkFields.push({ label: 'Discord', copyValue: draft.socialLinks.discord });
  if (draft.socialLinks.website)
    linkFields.push({ label: 'Site', href: draft.socialLinks.website });
  if (draft.contactEmail) linkFields.push({ label: 'Email', copyValue: draft.contactEmail });

  const handleCopy = useCallback((label: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1200);
    });
  }, []);

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
            <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-full border-2 border-foreground bg-background font-sans text-3xl font-bold text-foreground">
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
            {linkFields.map((field) =>
              field.href ? (
                <a
                  key={field.label}
                  href={field.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground underline underline-offset-4 hover:bg-foreground hover:text-background"
                >
                  {field.label}
                </a>
              ) : (
                <button
                  key={field.label}
                  type="button"
                  onClick={() => handleCopy(field.label, field.copyValue!)}
                  className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground underline underline-offset-4 hover:bg-foreground hover:text-background"
                >
                  {copiedField === field.label ? 'Copiado!' : field.label}
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}

      {/* Cards */}
      <div className={`px-4 ${cards.length > 0 ? 'pb-4' : ''}`}>
        {cards.length > 0 ? (
          <>
            <div className="mb-1 flex items-center justify-between border-b border-foreground/50 pb-2">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Vitrine
              </h3>
              <button
                type="button"
                onClick={() => setExpandedCards((prev) => !prev)}
                className="border border-foreground px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-foreground hover:text-background focus:outline-none"
              >
                {expandedCards ? '[ COLAPSAR ]' : `[ VER TODOS (${cards.length}) ]`}
              </button>
            </div>

            <AnimatePresence initial={false}>
              {expandedCards ? (
                <motion.div
                  key="expanded-cards"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="pb-4 pt-1"
                >
                  {Object.entries(groupedCards).map(([type, typeCards], groupIndex) => (
                    <motion.div
                      key={type}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: groupIndex * 0.07,
                        type: 'spring',
                        stiffness: 380,
                        damping: 28,
                      }}
                    >
                      <h4 className="mb-3 mt-4 border-b border-foreground/30 pb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {CARD_TYPE_LABELS[type as RichCardType]}
                      </h4>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {typeCards.map((card, cardIndex) => (
                          <motion.div
                            key={card.id}
                            initial={{ opacity: 0, scale: 0.96, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            transition={{
                              delay: groupIndex * 0.07 + cardIndex * 0.045,
                              type: 'spring',
                              stiffness: 420,
                              damping: 30,
                            }}
                          >
                            <RichCardView card={card} className="w-full" />
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="collapsed-cards"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pt-1"
                >
                  {cards.map((card) => (
                    <RichCardView key={card.id} card={card} className="w-72" />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
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
