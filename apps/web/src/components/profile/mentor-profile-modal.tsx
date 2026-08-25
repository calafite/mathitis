import { type CSSProperties, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Profile, RichCard } from '@mathitis/schemas';
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
    return <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{artistName}</p>;
  }
  const steamAppId = meta?.steamAppId;
  if (card.cardType === 'game' && typeof steamAppId === 'string') {
    return <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Steam · {steamAppId}</p>;
  }
  if (card.cardType === 'film') {
    const rating = meta?.rating;
    if (typeof rating === 'number') {
      return (
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
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

function RichCardView({ card }: { card: RichCard }) {
  const meta = CARD_META[card.cardType] ?? { label: 'Cartão', icon: '✦' };
  return (
    <article className="flex flex-col rounded-none border border-foreground p-3">
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

interface MentorProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seniorHandle: string;
}

export function MentorProfileModal({ open, onOpenChange, seniorHandle }: MentorProfileModalProps) {
  const [bumped, setBumped] = useState(false);
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
      await discoveryApi.bump(seniorHandle);
      setBumped(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao impulsionar');
    }
  };

  const handleRemoveBump = async () => {
    try {
      await discoveryApi.removeBump(seniorHandle);
      setBumped(false);
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

  const socialLinks = profile?.socialLinks as Record<string, string | undefined> | null;
  const linkFields: Array<{ label: string; href: string }> = [];
  if (socialLinks?.github) linkFields.push({ label: 'GitHub', href: socialLinks.github });
  if (socialLinks?.linkedin) linkFields.push({ label: 'LinkedIn', href: socialLinks.linkedin });
  if (socialLinks?.discord) linkFields.push({ label: 'Discord', href: socialLinks.discord });
  if (socialLinks?.website) linkFields.push({ label: 'Site', href: socialLinks.website });
  if (profile?.contactEmail) linkFields.push({ label: 'Email', href: `mailto:${profile.contactEmail}` });

  const richCards = profile?.richCards ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-none border-2 border-foreground bg-background text-foreground"
        >
          {/* Title bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-foreground bg-background px-4 py-2.5">
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-foreground">
              Perfil de Mentor <span className="text-muted-foreground">// @{profile?.handle ?? seniorHandle}</span>
            </span>
            <Dialog.Close
              className="border border-foreground p-1 text-foreground transition-colors hover:bg-foreground hover:text-background focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          {bannerStyle && (
            <div className="h-24 border-b border-foreground" style={bannerStyle} role="presentation" />
          )}

          {profile && (
            <>
              {/* Header */}
              <div className="flex items-end justify-between border-b border-foreground/50 px-4 pb-3">
                <div className="flex items-end gap-3">
                  {profile.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt=""
                      className="-mt-10 h-20 w-20 rounded-full border-2 border-foreground bg-background object-cover"
                    />
                  ) : (
                    <div className="-mt-10 flex h-20 w-20 items-center justify-center rounded-full border-2 border-foreground bg-background font-sans text-3xl font-bold">
                      {(profile.socialName ?? profile.handle ?? '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="pb-1">
                    <h2 className="font-sans text-2xl font-bold uppercase leading-tight">
                      {profile.socialName ?? profile.handle}
                    </h2>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      @{profile.handle}
                      {profile.pronouns ? <span className="ml-2">{profile.pronouns}</span> : null}
                    </p>
                  </div>
                </div>
                <span
                  className={`mb-1 shrink-0 rounded-none px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest ${
                    profile.isAcceptingRequests
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-foreground text-muted-foreground'
                  }`}
                >
                  {profile.isAcceptingRequests ? 'Aceitando ferinhas' : 'Capacidade cheia'}
                </span>
              </div>

              {/* Tagline */}
              {profile.tagline ? (
                <div className="border-b border-foreground/50 px-4 py-2">
                  <p className="font-mono text-xs italic uppercase text-foreground">{profile.tagline}</p>
                </div>
              ) : null}

              {/* Biography */}
              <section className="border-b border-foreground/50 px-4 pb-3">
                <h3 className="py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Biografia
                </h3>
                <MarkdownPreview markdown={profile.biographyMarkdown} />
              </section>

              {/* Links */}
              {linkFields.length > 0 && (
                <section className="border-b border-foreground/50 px-4 pb-3">
                  <h3 className="py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Contato
                  </h3>
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
                </section>
              )}

              {/* Cards */}
              {richCards.length > 0 && (
                <section className="px-4 pb-4">
                  <div className="flex items-center justify-between py-2">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Vitrine
                    </h3>
                    <span className="border border-foreground px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest">
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

              {/* Footer stats */}
              <div className="flex justify-between border-t border-foreground py-1 pl-2 pr-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                <span>Até {profile.maxMentees ?? 3} ferinhas</span>
                <span>Pontuação de esforço {profile.effortScore ?? 0}</span>
              </div>

              {/* Action bar */}
              <div className="flex flex-col gap-3 border-t border-foreground bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={bumped ? handleRemoveBump : handleBump}
                  disabled={isLoading}
                  className="w-full rounded-none border border-foreground bg-transparent px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background disabled:opacity-50 sm:w-auto"
                >
                  {bumped ? 'Remover impulso' : 'Impulsionar perfil'}
                </button>

                <div className="sm:text-right">
                  {profile.isAcceptingRequests ? (
                    <button
                      type="button"
                      onClick={handleRequest}
                      disabled={requestSent || isLoading}
                      className="w-full rounded-none border border-foreground bg-transparent px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background disabled:opacity-50 sm:w-auto"
                    >
                      {requestSent ? 'Pedido enviado' : 'Pedir apadrinhamento'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full cursor-not-allowed rounded-none border border-foreground bg-transparent px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground sm:w-auto"
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
