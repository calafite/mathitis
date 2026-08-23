import { type CSSProperties, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Github, Linkedin, Mail, MessageSquare, Globe } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Profile, RichCard, ThemePalette, SocialLinks } from '@mathitis/schemas';
import { profileApi } from '@/lib/profile-api';
import { discoveryApi } from '@/lib/discovery-api';
import { requestsApi, buildIdempotencyKey } from '@/lib/requests-api';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';
import { Button } from '@/components/ui/button';

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
          <span
            key={String(item)}
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              background: 'var(--profile-badge, var(--color-primary))',
              color: 'var(--profile-badge-foreground, var(--color-primary-foreground))',
            }}
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
  const styleVar = { '--profile-card-accent': card.accentColor } as React.CSSProperties & Record<string, string>;
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

function SocialLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
    >
      <Icon className="h-4 w-4" />
      {label}
    </a>
  );
}

function AvatarBadge({ children, size = 10, className = '' }: { children: React.ReactNode; size?: number; className?: string }) {
  return (
    <div
      className={`flex h-${size} w-${size} items-center justify-center rounded-full border-4 text-2xl font-bold shadow ${className}`}
      style={{
        background: 'var(--profile-primary, var(--color-primary))',
        color: 'var(--profile-primary-foreground, var(--color-primary-foreground))',
        borderColor: 'var(--profile-primary, var(--color-primary))',
      }}
    >
      {children}
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

  const theme = profile?.themePalette as ThemePalette | null;
  const cssVars: React.CSSProperties & Record<string, string> = theme
    ? {
        '--profile-primary': theme.primaryColor,
        '--profile-accent': theme.accentColor,
        '--profile-badge': theme.badgeColor,
        '--profile-card-bg':
          theme.cardStyle === 'glassmorphic'
            ? 'rgba(255, 255, 255, 0.65)'
            : theme.cardStyle === 'solid'
              ? 'rgba(255, 255, 255, 0.98)'
              : 'transparent',
      }
    : {};

  const cardClass = theme
    ? theme.cardStyle === 'glassmorphic'
      ? 'backdrop-blur-md bg-card/60 border-border/40'
      : theme.cardStyle === 'solid'
        ? 'bg-card'
        : 'bg-transparent border-2'
    : 'bg-card';

  const bannerStyle: CSSProperties = {
    backgroundImage: profile?.bannerUrl
      ? `url(${profile.bannerUrl})`
      : profile?.bannerPreset === 'gradient_cosmic'
        ? 'linear-gradient(135deg, var(--profile-primary), var(--profile-accent))'
        : 'linear-gradient(135deg, var(--profile-primary), var(--profile-accent))',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  const socialLinks = profile?.socialLinks as SocialLinks | null;
  const hasSocialLinks = Boolean(
    socialLinks?.github ||
      socialLinks?.linkedin ||
      socialLinks?.discord ||
      socialLinks?.website ||
      profile?.contactEmail,
  );

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-popover text-popover-foreground shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:max-w-5xl"
        >
          <Dialog.Close
            className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-popover disabled:pointer-events-none data-[state=open]:bg-accent"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Fechar</span>
          </Dialog.Close>

          <div className="p-6" style={cssVars}>
            <div
              className="relative h-32 rounded-xl overflow-hidden"
              style={bannerStyle}
            >
              {profile?.bannerPreset && !profile?.bannerUrl ? (
                <span className="absolute bottom-2 right-3 text-xs font-medium text-white/80">
                  {profile.bannerPreset}
                </span>
              ) : null}
            </div>

            <div className={`mt-6 -mb-10 flex flex-col items-center ${cardClass}`}>
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="h-20 w-20 -mt-10 rounded-full border-4 border-card object-cover shadow-lg"
                />
              ) : (
                <AvatarBadge size={20} className="-mt-10">
                  {(profile?.socialName ?? profile?.handle ?? '?').charAt(0).toUpperCase()}
                </AvatarBadge>
              )}

              <div className="mt-4 text-center">
                <h2 className="text-2xl font-bold text-foreground">
                  {profile?.socialName ?? profile?.handle}
                </h2>
                <div className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  {profile?.pronouns && <span>{profile.pronouns}</span>}
                  <span>@{profile?.handle}</span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    Período {profile?.semester}
                  </span>
                </div>
                {profile?.tagline && (
                  <p className="mt-2 text-sm text-foreground/80">{profile.tagline}</p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{
                    background: profile?.isAcceptingRequests
                      ? 'color-mix(in srgb, var(--color-primary) 20%, transparent)'
                      : 'var(--color-muted)',
                    color: profile?.isAcceptingRequests
                      ? 'var(--color-primary)'
                      : 'var(--color-muted-foreground)',
                  }}
                >
                  {profile?.isAcceptingRequests ? 'Aceitando pupilos' : 'Capacidade cheia'}
                </span>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-muted-foreground bg-muted">
                  0 / {profile?.maxMentees ?? 3} pupilos
                </span>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-primary bg-primary/15">
                  Pontuação de esforço {profile?.effortScore ?? 0}
                </span>
              </div>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-foreground">Biografia</h3>
                  <MarkdownPreview markdown={profile?.biographyMarkdown} />
                </div>

                {profile?.tags && profile.tags.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">Interesses</h3>
                    <div className="flex flex-wrap gap-2">
                      {profile.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className="rounded-full px-2.5 py-1 text-xs font-medium text-white"
                          style={{ background: tag.color }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {hasSocialLinks && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">Contato</h3>
                    <div className="flex flex-wrap gap-3">
                      {socialLinks?.github && <SocialLink href={socialLinks.github} label="GitHub" icon={Github} />}
                      {socialLinks?.linkedin && <SocialLink href={socialLinks.linkedin} label="LinkedIn" icon={Linkedin} />}
                      {socialLinks?.discord && <SocialLink href={socialLinks.discord} label="Discord" icon={MessageSquare} />}
                      {socialLinks?.website && <SocialLink href={socialLinks.website} label="Site" icon={Globe} />}
                      {profile?.contactEmail && (
                        <SocialLink href={`mailto:${profile.contactEmail}`} label={profile.contactEmail} icon={Mail} />
                      )}
                    </div>
                  </div>
                )}

                {profile?.richCards && profile.richCards.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-foreground">Vitrine</h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {profile.richCards.map((card) => (
                        <RichCardView key={card.id} card={card} />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="lg:col-span-1">
                <div className="sticky top-24 space-y-4">
                  <div className="flex flex-col gap-2">
                    <Button
                      size="lg"
                      variant={bumped ? 'outline' : 'default'}
                      onClick={bumped ? handleRemoveBump : handleBump}
                      disabled={isLoading}
                      className="w-full"
                    >
                      {bumped ? 'Remover impulso' : 'Impulsionar perfil'}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      {bumpCount} impulsos · máx. 4 por período
                    </p>
                  </div>

                  {profile?.isAcceptingRequests ? (
                    <Button
                      size="lg"
                      variant="outline"
                      onClick={handleRequest}
                      disabled={requestSent || isLoading}
                      className="w-full"
                    >
                      {requestSent ? 'Pedido enviado' : 'Pedir apadrinhamento'}
                    </Button>
                  ) : (
                    <Button size="lg" variant="outline" disabled className="w-full">
                      Não aceitando pedidos
                    </Button>
                  )}

                  {error && <p className="text-center text-sm text-destructive">{error}</p>}
                </div>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}