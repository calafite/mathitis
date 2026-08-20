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
  song: { label: 'Song', icon: '♪' },
  game: { label: 'Game', icon: '▣' },
  film: { label: 'Film', icon: '▶' },
  book: { label: 'Book', icon: '📖' },
  project: { label: 'Project', icon: '⚙' },
  custom: { label: 'Card', icon: '✦' },
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
      Open source
    </a>
  );
}

function CardContent({ card }: { card: RichCard }) {
  const meta = card.metadata as Record<string, unknown> | null;
  const artistName = meta?.artistName;
  if (card.cardType === 'song' && typeof artistName === 'string' && artistName) {
    return <p className="text-xs text-slate-500">{artistName}</p>;
  }
  const steamAppId = meta?.steamAppId;
  if (card.cardType === 'game' && typeof steamAppId === 'string') {
    return <p className="text-xs text-slate-500">Steam App {steamAppId}</p>;
  }
  if (card.cardType === 'film') {
    const rating = meta?.rating;
    if (typeof rating === 'number') {
      return <p className="text-xs text-slate-500">Rating {rating.toFixed(1)}/10</p>;
    }
  }
  if (card.cardType === 'project' && Array.isArray(meta?.techStack)) {
    const stack = (meta.techStack as unknown[]).slice(0, 4);
    return (
      <div className="mt-2 flex flex-wrap gap-1">
        {stack.map((item) => (
          <span
            key={String(item)}
            className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
            style={{ background: 'var(--profile-badge, #3b82f6)' }}
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
  const meta = CARD_META[card.cardType] ?? { label: 'Card', icon: '✦' };
  const styleVar = { '--profile-card-accent': card.accentColor } as CSSProperties;
  return (
    <article
      className="profile-card flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm"
      style={styleVar}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{card.title}</h3>
        <span className="text-base text-slate-400" aria-hidden>
          {meta.icon}
        </span>
      </div>
      {card.subtitle ? <p className="text-xs text-slate-500 dark:text-slate-400">{card.subtitle}</p> : null}
      {card.description ? <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{card.description}</p> : null}
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
      className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
    >
      <Icon className="h-4 w-4" />
      {label}
    </a>
  );
}

function AvatarBadge({ children, size = 10, className = '' }: { children: React.ReactNode; size?: number; className?: string }) {
  return (
    <div
      className={`flex h-${size} w-${size} items-center justify-center rounded-full border-4 border-white text-2xl font-bold text-white shadow ${className}`}
      style={{ background: 'var(--profile-primary, #6366f1)' }}
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
      setError(err instanceof Error ? err.message : 'Failed to bump');
    }
  };

  const handleRemoveBump = async () => {
    try {
      await discoveryApi.removeBump(seniorHandle);
      setBumped(false);
      setBumpCount((c) => Math.max(0, c - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove bump');
    }
  };

  const handleRequest = async () => {
    if (requestSent) return;
    setError(null);
    try {
      await requestsApi.create(
        { seniorHandle, message: 'I would love to connect and learn from your experience.' },
        buildIdempotencyKey(),
      );
      setRequestSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
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
      ? 'backdrop-blur-md bg-white/60 dark:bg-slate-800/60 border-white/40 dark:border-slate-700/40'
      : theme.cardStyle === 'solid'
        ? 'bg-white dark:bg-slate-800'
        : 'bg-transparent border-2'
    : 'bg-white dark:bg-slate-800';

  const bannerStyle: CSSProperties = {
    backgroundImage: profile?.bannerUrl
      ? `url(${profile.bannerUrl})`
      : profile?.bannerPreset === 'gradient_cosmic'
        ? 'linear-gradient(135deg, #6366f1, #ec4899)'
        : `linear-gradient(135deg, ${theme?.primaryColor ?? '#6366f1'}, ${theme?.accentColor ?? '#ec4899'})`,
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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed z-50 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-950 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:max-w-5xl"
        >
          <Dialog.Close
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-white transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-slate-100 dark:data-[state=open]:bg-slate-800 dark:ring-offset-slate-950"
          >
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
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
                  className="h-20 w-20 -mt-10 rounded-full border-4 border-white dark:border-slate-950 object-cover shadow-lg"
                />
              ) : (
                <AvatarBadge size={20} className="-mt-10">
                  {(profile?.socialName ?? profile?.handle ?? '?').charAt(0).toUpperCase()}
                </AvatarBadge>
              )}

              <div className="mt-4 text-center">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {profile?.socialName ?? profile?.handle}
                </h2>
                <div className="mt-1 flex items-center justify-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  {profile?.pronouns && <span>{profile.pronouns}</span>}
                  <span>@{profile?.handle}</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                    Semester {profile?.semester}
                  </span>
                </div>
                {profile?.tagline && (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{profile.tagline}</p>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <span
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-white"
                  style={{
                    background: profile?.isAcceptingRequests ? '#16a34a' : '#64748b',
                  }}
                >
                  {profile?.isAcceptingRequests ? 'Accepting mentees' : 'Capacity full'}
                </span>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800">
                  0 / {profile?.maxMentees ?? 3} pupils
                </span>
                <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30">
                  Effort score {profile?.effortScore ?? 0}
                </span>
              </div>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Biography</h3>
                  <MarkdownPreview markdown={profile?.biographyMarkdown} />
                </div>

                {profile?.tags && profile.tags.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Interests</h3>
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
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Contact</h3>
                    <div className="flex flex-wrap gap-3">
                      {socialLinks?.github && <SocialLink href={socialLinks.github} label="GitHub" icon={Github} />}
                      {socialLinks?.linkedin && <SocialLink href={socialLinks.linkedin} label="LinkedIn" icon={Linkedin} />}
                      {socialLinks?.discord && <SocialLink href={socialLinks.discord} label="Discord" icon={MessageSquare} />}
                      {socialLinks?.website && <SocialLink href={socialLinks.website} label="Website" icon={Globe} />}
                      {profile?.contactEmail && (
                        <SocialLink href={`mailto:${profile.contactEmail}`} label={profile.contactEmail} icon={Mail} />
                      )}
                    </div>
                  </div>
                )}

                {profile?.richCards && profile.richCards.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Showcase</h3>
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
                      {bumped ? 'Remove bump' : 'Bump profile'}
                    </Button>
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                      {bumpCount} bumps · 4 max per semester
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
                      {requestSent ? 'Request sent' : 'Apply for mentorship'}
                    </Button>
                  ) : (
                    <Button size="lg" variant="outline" disabled className="w-full">
                      Not accepting requests
                    </Button>
                  )}

                  {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
                </div>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}