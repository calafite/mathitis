import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SeniorSummary, Tag } from '@mathitis/schemas';
import { useAuth } from '@/contexts/auth-context';
import { discoveryApi } from '@/lib/discovery-api';
import { Button } from '@/components/ui/button';
import { MentorProfileModal } from '@/components/profile/mentor-profile-modal';
import { usePageMeta } from '@/lib/use-page-meta';

function avatar(src: string | null, alt: string) {
  if (!src) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-lg font-bold text-accent-foreground">
        {alt.charAt(0).toUpperCase()}
      </div>
    );
  }
  return <img src={src} alt={alt} className="h-16 w-16 rounded-full object-cover" />;
}

function SeniorCard({
  senior,
  role,
  score,
  matchReasons,
  onBump,
  onViewProfile,
  bumping,
}: {
  senior: SeniorSummary;
  role?: string;
  score?: number;
  matchReasons?: string[];
  onBump: () => void;
  onViewProfile: () => void;
  bumping: boolean;
}) {
  const isFreshman = role === 'freshman';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Ver perfil completo de ${senior.socialName ?? senior.handle}`}
      onClick={onViewProfile}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onViewProfile();
        }
      }}
      className="flex cursor-pointer flex-col rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start gap-3">
        {avatar(senior.avatarThumbnailUrl, senior.socialName ?? senior.handle)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold text-foreground">
              {senior.socialName ?? senior.handle}
            </span>
            {score !== undefined && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {Math.round(score)}% de compatibilidade
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            @{senior.handle} · Período {senior.semester}
          </p>
        </div>
      </div>

      {senior.tagline && <p className="mt-2 text-sm text-foreground/80">{senior.tagline}</p>}

      {senior.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {senior.tags.slice(0, 6).map((tag) => (
            <span
              key={tag.id}
              className="rounded-full px-2 py-0.5 text-xs"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span>💬 {senior.effortScore} de esforço</span>
        <span>👁 {senior.profileViews} visualizações</span>
        <span>⬆ {senior.bumpCount} impulsos</span>
        <span className={senior.isAcceptingRequests ? 'text-emerald-500' : 'text-muted-foreground/60'}>
          {senior.isAcceptingRequests ? 'Aceitando pedidos' : 'Fechado a pedidos'}
        </span>
      </div>

      {matchReasons && matchReasons.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-2">
          {matchReasons.map((reason) => (
            <li key={reason} className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="mt-0.5 text-primary">
                ✦
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {isFreshman && (
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={bumping}
            onClick={(e) => {
              e.stopPropagation();
              onBump();
            }}
            className="w-full"
          >
            {bumping ? '…' : 'Impulsionar'}
          </Button>
        </div>
      )}
    </div>
  );
}

export function DiscoveryPage() {
  usePageMeta('Descoberta de Padrinhos', 'Explore os veteranos disponíveis, filtre por interesses e encontre seu padrinho acadêmico.');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [semester, setSemester] = useState<number | undefined>(undefined);
  const [availability, setAvailability] = useState<'accepting' | 'full' | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [bumpedSet, setBumpedSet] = useState<Set<string>>(new Set());
  const [profileModalHandle, setProfileModalHandle] = useState<string | null>(null);

  const isFreshman = user?.role === 'freshman';

  const tagsQuery = useQuery({
    queryKey: ['tags'],
    queryFn: () => discoveryApi.listTags(),
  });

  const seniorsQuery = useQuery({
    queryKey: ['seniors', { semester, availability, selectedTags, showRecommendations }],
    queryFn: () =>
      showRecommendations
        ? discoveryApi.recommendations(20).then((r) => r.recommendations)
        : discoveryApi
            .listSeniors({
              semester,
              availability,
              tagIds: selectedTags.length > 0 ? selectedTags : undefined,
              limit: 30,
            })
            .then((r) => r.seniors),
  });

  const bumpMutation = useMutation({
    mutationFn: (handle: string) => discoveryApi.bump(handle),
    onSuccess: (_data, handle) => {
      setBumpedSet((prev) => new Set(prev).add(handle));
      void queryClient.invalidateQueries({ queryKey: ['seniors'] });
    },
  });

  const removeBumpMutation = useMutation({
    mutationFn: (handle: string) => discoveryApi.removeBump(handle),
    onSuccess: (_data, handle) => {
      setBumpedSet((prev) => {
        const next = new Set(prev);
        next.delete(handle);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: ['seniors'] });
    },
  });

  const groupedTags = useMemo(() => {
    const map = new Map<string, Tag[]>();
    for (const tag of tagsQuery.data?.tags ?? []) {
      const list = map.get(tag.category) ?? [];
      list.push(tag);
      map.set(tag.category, list);
    }
    return Array.from(map.entries());
  }, [tagsQuery.data]);

  const isBumped = (handle: string) => bumpedSet.has(handle);

  const handleBumpClick = (handle: string) => {
    if (isBumped(handle)) {
      void removeBumpMutation.mutateAsync(handle);
    } else {
      void bumpMutation.mutateAsync(handle);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-foreground">Descoberta</h1>
        </div>
        <div className="flex items-center gap-3">
          {isFreshman && (
            <Button variant="outline" size="sm" onClick={() => setShowRecommendations((v) => !v)}>
              {showRecommendations ? 'Mostrar catálogo' : 'Mostrar recomendações'}
            </Button>
          )}
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-foreground text-sm"
          value={semester ?? ''}
          onChange={(e) => setSemester(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">Todos os períodos</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => (
            <option key={s} value={s}>
              Período {s}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-foreground text-sm"
          value={availability ?? ''}
          onChange={(e) =>
            setAvailability(e.target.value ? (e.target.value as 'accepting' | 'full') : undefined)
          }
        >
          <option value="">Qualquer disponibilidade</option>
          <option value="accepting">Aceitando pedidos</option>
          <option value="full">Sem vagas</option>
        </select>
        {groupedTags.map(([category, tags]) => (
          <div
            key={category}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2 py-1.5"
          >
            <span className="text-xs font-medium text-muted-foreground">{category}</span>
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  selectedTags.includes(tag.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        ))}
      </div>


      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seniorsQuery.isLoading && <p className="text-muted-foreground">Carregando…</p>}
        {seniorsQuery.data?.map((senior) => (
          <SeniorCard
            key={senior.userId}
            senior={senior}
            role={user?.role}
            score={
              'score' in senior ? (senior as SeniorSummary & { score: number }).score : undefined
            }
            matchReasons={
              'matchReasons' in senior
                ? (senior as SeniorSummary & { matchReasons: string[] }).matchReasons
                : undefined
            }
            onBump={() => handleBumpClick(senior.handle)}
            onViewProfile={() => setProfileModalHandle(senior.handle)}
            bumping={bumpMutation.isPending || removeBumpMutation.isPending}
          />
        ))}
      </div>

      <MentorProfileModal
        open={profileModalHandle !== null}
        onOpenChange={(open) => !open && setProfileModalHandle(null)}
        seniorHandle={profileModalHandle ?? ''}
      />
    </div>
  );
}
