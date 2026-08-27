import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import type { Profile, RichCardType } from '@mathitis/schemas';
import { profileApi } from '@/lib/profile-api';
import { discoveryApi } from '@/lib/discovery-api';
import { requestsApi, buildIdempotencyKey } from '@/lib/requests-api';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';
import { RichCardView } from './rich-card-view';
import { CARD_TYPE_LABELS, groupCardsByType } from './rich-card-catalog';

interface MentorProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seniorHandle: string;
}

export function MentorProfileModal({ open, onOpenChange, seniorHandle }: MentorProfileModalProps) {
  const [bumped, setBumped] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState(false);

  const { data: profileData, isLoading, refetch } = useQuery({
    queryKey: ['profile', seniorHandle],
    queryFn: () => profileApi.getByHandle(seniorHandle).then((r) => r.profile),
    enabled: open && Boolean(seniorHandle),
  });

  useEffect(() => {
    if (open) {
      refetch();
    } else {
      setExpandedCards(false);
      setCopiedField(null);
    }
  }, [open, refetch]);

  const handleBump = async () => {
    if (bumped) return;
    try {
      await discoveryApi.bump(seniorHandle);
      setBumped(true);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao impulsionar';
      setError(msg);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleRemoveBump = async () => {
    try {
      await discoveryApi.removeBump(seniorHandle);
      setBumped(false);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao remover impulso';
      setError(msg);
      setTimeout(() => setError(null), 3000);
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
      const msg = err instanceof Error ? err.message : 'Falha no pedido';
      setError(msg);
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleCopy = useCallback((label: string, value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 1200);
    });
  }, []);

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
  const linkFields: Array<{ label: string; href?: string; copyValue?: string }> = [];
  if (socialLinks?.github) linkFields.push({ label: 'GitHub', href: socialLinks.github });
  if (socialLinks?.linkedin) linkFields.push({ label: 'LinkedIn', href: socialLinks.linkedin });
  if (socialLinks?.discord) linkFields.push({ label: 'Discord', copyValue: socialLinks.discord });
  if (socialLinks?.website) linkFields.push({ label: 'Site', href: socialLinks.website });
  if (profile?.contactEmail) linkFields.push({ label: 'Email', copyValue: profile.contactEmail });

  const richCards = profile?.richCards ?? [];
  const groupedCards = groupCardsByType(richCards);

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
              <div className="relative z-10 flex items-end justify-between border-b border-foreground/50 px-4 pb-3">
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

              {/* Tag badges */}
              {profile.tags.length > 0 && (
                <div className="border-b border-foreground/50 px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {profile.tags.map((tag) => (
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
              )}

              {/* Links */}
              {linkFields.length > 0 && (
                <section className="border-b border-foreground/50 px-4 pb-3">
                  <h3 className="py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Contato
                  </h3>
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
                </section>
              )}

              {/* Cards */}
              {richCards.length > 0 && (
                <section className="px-4 pb-4">
                  <div className="mb-2 flex items-center justify-between border-b border-foreground/50 pb-2">
                    <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Vitrine
                    </h3>
                    <button
                      type="button"
                      onClick={() => setExpandedCards((prev) => !prev)}
                      className="border border-foreground px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-foreground hover:text-background focus:outline-none"
                    >
                      {expandedCards ? '[ COLAPSAR ]' : `[ VER TODOS (${richCards.length}) ]`}
                    </button>
                  </div>

                  {expandedCards ? (
                    <div>
                      {Object.entries(groupedCards).map(([type, typeCards]) => (
                        <div key={type}>
                          <h4 className="mb-3 mt-4 border-b border-foreground/30 pb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {CARD_TYPE_LABELS[type as RichCardType]}
                          </h4>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {typeCards.map((card) => (
                              <RichCardView key={card.id} card={card} className="w-full" />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pt-1">
                      {richCards.map((card) => (
                        <RichCardView key={card.id} card={card} className="w-72" />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Footer stats */}
              <div className="flex justify-between border-t border-foreground py-1 pl-2 pr-2 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                <span>Até {profile.maxMentees ?? 3} ferinhas</span>
                <span>Pontuação de esforço {profile.effortScore ?? 0}</span>
              </div>

              {/* Action bar */}
              <div className="relative flex flex-col gap-3 border-t border-foreground bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                {error && (
                  <p className="absolute -top-4 left-4 bg-background px-2 font-mono text-[10px] uppercase tracking-wide text-destructive">
                    {error}
                  </p>
                )}
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
