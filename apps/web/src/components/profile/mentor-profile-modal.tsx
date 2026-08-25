import { type CSSProperties, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Github, Linkedin, Mail, MessageSquare, Globe } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Profile, RichCard, SocialLinks } from '@mathitis/schemas';
import { profileApi } from '@/lib/profile-api';
import { discoveryApi } from '@/lib/discovery-api';
import { requestsApi, buildIdempotencyKey } from '@/lib/requests-api';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';

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
      className="mt-2 aspect-video w-full border border-white/15"
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
      className="mt-2 inline-block font-mono text-[10px] font-bold uppercase tracking-widest text-[#c9f24c] underline hover:no-underline"
    >
      Código aberto ↗
    </a>
  );
}

function CardContent({ card }: { card: RichCard }) {
  const meta = card.metadata as Record<string, unknown> | null;
  const artistName = meta?.artistName;
  if (card.cardType === 'song' && typeof artistName === 'string' && artistName) {
    return <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{artistName}</p>;
  }
  const steamAppId = meta?.steamAppId;
  if (card.cardType === 'game' && typeof steamAppId === 'string') {
    return <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Steam · {steamAppId}</p>;
  }
  if (card.cardType === 'film') {
    const rating = meta?.rating;
    if (typeof rating === 'number') {
      return (
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          ★ {rating.toFixed(1)}/10
        </p>
      );
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
            className="border border-white/25 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase"
          >
            {String(item)}
          </span>
        ))}
        {extra > 0 && (
          <span className="border border-white/25 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase opacity-60">
            +{extra}
          </span>
        )}
      </div>
    );
  }
  return null;
}

function RichCardView({ card }: { card: RichCard }) {
  const meta = CARD_META[card.cardType] ?? { label: 'Cartão', icon: '✦' };
  return (
    <article className="flex flex-col border border-white/15 bg-[#0d0d0f] p-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold leading-tight">{card.title}</h3>
        <span
          className="shrink-0 border border-white/25 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest"
          aria-label={meta.label}
        >
          {meta.icon} {meta.label}
        </span>
      </div>
      {card.subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{card.subtitle}</p> : null}
      {card.description ? <p className="mt-1 text-xs text-foreground/80">{card.description}</p> : null}
      <CardContent card={card} />
      <CardEmbed card={card} />
      <CardLink card={card} />
    </article>
  );
}

function SocialLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 border border-white/15 px-2 py-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-foreground transition-colors hover:border-[#c9f24c] hover:text-[#c9f24c]"
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {label}
    </a>
  );
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border border-white/15 px-3 py-2">
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={`flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums ${
          accent ? 'text-[#c9f24c]' : 'text-foreground'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

interface MentorProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seniorHandle: string;
}

export function MentorProfileModal({ open, onOpenChange, seniorHandle }: MentorProfileModalProps) {
  const [bumped, setBumped] = useState(false);
  const [bumpCount, setBumpCount] = useState(0);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: profileData, isLoading, refetch } = useQuery({
    queryKey: ['profile', seniorHandle],
    queryFn: () => profileApi.getByHandle(seniorHandle).then((r) => r.profile),
    enabled: open && Boolean(seniorHandle),
  });

  useEffect(() => {
    if (open) {
      refetch();
    }
  }, [open, refetch]);

  const handleBump = async () => {
    if (bumped) return;
    try {
      const res = await discoveryApi.bump(seniorHandle);
      setBumped(true);
      setBumpCount(res.bumpCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao impulsionar');
    }
  };

  const handleRemoveBump = async () => {
    try {
      await discoveryApi.removeBump(seniorHandle);
      setBumped(false);
      setBumpCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover impulso');
    }
  };

  const handleRequest = async () => {
    if (requestSent) return;
    setError(null);
    try {
      await requestsApi.create(
        { seniorHandle, message: 'Adoraria me conectar e aprender com a sua experiência.' },
        buildIdempotencyKey(),
      );
      setRequestSent(true);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no pedido');
    }
  };

  if (!open) return null;

  const profile = profileData as Profile | undefined;
  if (!profile && !isLoading) return null;

  const bannerStyle: CSSProperties | undefined = profile?.bannerUrl
    ? {
        backgroundImage: `url(${profile.bannerUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  const socialLinks = profile?.socialLinks as SocialLinks | null;
  const hasSocialLinks = Boolean(
    socialLinks?.github ||
      socialLinks?.linkedin ||
      socialLinks?.discord ||
      socialLinks?.website ||
      profile?.contactEmail,
  );

  const tags = profile?.tags ?? [];
  const visibleTags = tags.slice(0, 8);
  const extraTags = tags.length - visibleTags.length;
  const richCards = profile?.richCards ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border-2 border-[#c9ced8]/50 bg-[#0a0a0b] text-foreground"
          style={{ boxShadow: '10px 10px 0 0 rgba(201, 206, 216, 0.12)' }}
        >
          {/* Title bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/15 bg-[#0a0a0b] px-4 py-2.5">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">
              Perfil de Mentor <span className="text-muted-foreground">// @{profile?.handle ?? seniorHandle}</span>
            </span>
            <Dialog.Close
              className="border border-white/30 p-1 text-foreground transition-colors hover:border-[#c9f24c] hover:text-[#c9f24c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9f24c]"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {bannerStyle && (
            <div className="h-24 border-b border-white/15" style={bannerStyle} role="presentation" />
          )}

          {profile && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
                {/* Left column */}
                <div className="space-y-4 border-b border-white/15 p-5 md:border-b-0 md:border-r">
                  <div className="flex flex-col items-center text-center">
                    {profile.avatarUrl ? (
                      <img
                        src={profile.avatarUrl}
                        alt=""
                        className="h-24 w-24 border-2 border-white/60 object-cover"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center border-2 border-white/60 font-sans text-4xl font-bold">
                        {(profile.socialName ?? profile.handle ?? '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <h2 className="mt-3 font-sans text-2xl font-bold uppercase leading-tight tracking-tight">
                      {profile.socialName ?? profile.handle}
                    </h2>
                    <p className="font-mono text-xs text-muted-foreground">@{profile.handle}</p>
                    <span className="mt-2 border-2 border-[#c9f24c] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#c9f24c]">
                      Período {profile.semester}
                    </span>
                    {profile.pronouns && (
                      <p className="mt-1 text-xs text-muted-foreground">{profile.pronouns}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <StatRow
                      label="Status"
                      accent={profile.isAcceptingRequests}
                      value={
                        <>
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2"
                            style={{ backgroundColor: profile.isAcceptingRequests ? '#22c55e' : '#6b7280' }}
                          />
                          {profile.isAcceptingRequests ? 'Aceitando ferinhas' : 'Capacidade cheia'}
                        </>
                      }
                    />
                    <StatRow label="Pontuação de esforço" value={String(profile.effortScore ?? 0)} />
                    <StatRow label="Capacidade" value={`0/${profile.maxMentees ?? 3}`} />
                  </div>

                  {profile.tagline && (
                    <p className="border-l-2 border-[#c9f24c] pl-3 text-xs text-foreground/80">
                      {profile.tagline}
                    </p>
                  )}

                  {hasSocialLinks && (
                    <div>
                      <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Contato
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {socialLinks?.github && (
                          <SocialLink href={socialLinks.github} label="GitHub" icon={Github} />
                        )}
                        {socialLinks?.linkedin && (
                          <SocialLink href={socialLinks.linkedin} label="LinkedIn" icon={Linkedin} />
                        )}
                        {socialLinks?.discord && (
                          <SocialLink href={socialLinks.discord} label="Discord" icon={MessageSquare} />
                        )}
                        {socialLinks?.website && (
                          <SocialLink href={socialLinks.website} label="Site" icon={Globe} />
                        )}
                        {profile.contactEmail && (
                          <SocialLink
                            href={`mailto:${profile.contactEmail}`}
                            label={profile.contactEmail}
                            icon={Mail}
                          />
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right column */}
                <div className="space-y-5 p-5">
                  <section>
                    <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">
                      Biografia
                    </h3>
                    <div className="border border-white/15 p-4">
                      <MarkdownPreview markdown={profile.biographyMarkdown} />
                    </div>
                  </section>

                  {tags.length > 0 && (
                    <section>
                      <h3 className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">
                        Interesses
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {visibleTags.map((tag) => (
                          <span
                            key={tag.id}
                            className="border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide"
                            style={{ borderColor: tag.color, color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        ))}
                        {extraTags > 0 && (
                          <span className="border border-white/25 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-muted-foreground">
                            +{extraTags}
                          </span>
                        )}
                      </div>
                    </section>
                  )}

                  {richCards.length > 0 && (
                    <section>
                      <div className="mb-2 flex items-center gap-2">
                        <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">
                          Vitrine
                        </h3>
                        <span className="border border-white/25 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          {richCards.length} {richCards.length === 1 ? 'cartão' : 'cartões'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {richCards.map((card) => (
                          <RichCardView key={card.id} card={card} />
                        ))}
                      </div>
                    </section>
                  )}
                </div>
              </div>

              {/* Action bar */}
              <div className="flex flex-col gap-3 border-t-2 border-white/15 bg-[#101012] p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <button
                    type="button"
                    onClick={bumped ? handleRemoveBump : handleBump}
                    disabled={isLoading}
                    className={`w-full border-2 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-widest transition-colors sm:w-auto ${
                      bumped
                        ? 'border-white/40 text-foreground hover:border-white'
                        : 'border-[#c9f24c] text-[#c9f24c] hover:bg-[#c9f24c] hover:text-black'
                    } disabled:opacity-50`}
                  >
                    {bumped ? 'Remover impulso' : 'Impulsionar perfil'}
                  </button>
                  <p className="mt-1.5 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:text-left">
                    {bumpCount} impulsos · máx. 4 por período
                  </p>
                </div>

                <div className="sm:text-right">
                  {profile.isAcceptingRequests ? (
                    <button
                      type="button"
                      onClick={handleRequest}
                      disabled={requestSent || isLoading}
                      className="w-full bg-white px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-[#c9f24c] disabled:opacity-50 sm:w-auto"
                    >
                      {requestSent ? 'Pedido enviado' : 'Pedir apadrinhamento'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed border-2 border-white/20 px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground sm:w-auto"
                    >
                      Não aceitando pedidos
                    </button>
                  )}
                  {error && (
                    <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-destructive">{error}</p>
                  )}
                </div>
              </div>
            </>
          )}

          {isLoading && (
            <div className="flex min-h-64 items-center justify-center">
              <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                Carregando perfil…
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
