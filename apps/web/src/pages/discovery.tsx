import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, ArrowRight } from 'lucide-react';
import type { SeniorSummary, Tag } from '@mathitis/schemas';
import { useAuth } from '@/contexts/auth-context';
import { discoveryApi } from '@/lib/discovery-api';
import { MentorProfileModal } from '@/components/profile/mentor-profile-modal';
import { ThemedSelect } from '@/components/ui/select';
import { usePageMeta } from '@/lib/use-page-meta';

const HEADER_BG = '#ececee';
const BODY_BG = '#b9bdc6';
const INK = '#0b0b0e';

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}K` : String(n);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-widest opacity-60">{label}</div>
      <div className="font-mono text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function MentorCard({
  senior,
  score,
  matchReasons,
  bumped,
  bumping,
  isFreshman,
  onOpen,
  onBump,
}: {
  senior: SeniorSummary;
  score?: number;
  matchReasons?: string[];
  bumped: boolean;
  bumping: boolean;
  isFreshman: boolean;
  onOpen: () => void;
  onBump: () => void;
}) {
  const name = senior.socialName ?? senior.handle;
  const visibleTags = senior.tags.slice(0, 4);
  const extraTags = senior.tags.length - visibleTags.length;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Ver perfil completo de ${name}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="flex cursor-pointer flex-col border-2 border-black transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c9f24c]"
      style={{ boxShadow: '6px 6px 0 0 rgba(201, 206, 216, 0.15)' }}
    >
      {/* Header */}
      <div className="relative p-4" style={{ backgroundColor: HEADER_BG, color: INK }}>
        <span
          className="absolute right-3 top-3 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest"
          style={{
            backgroundColor: senior.isAcceptingRequests ? INK : 'transparent',
            color: senior.isAcceptingRequests ? HEADER_BG : INK,
            border: senior.isAcceptingRequests ? 'none' : `2px solid ${INK}`,
          }}
        >
          {senior.isAcceptingRequests ? 'Disponível' : 'Lotado'}
        </span>
        <h3 className="pr-24 font-sans text-xl font-bold uppercase leading-tight tracking-tight">{name}</h3>
        <p className="font-mono text-xs opacity-70">@{senior.handle}</p>
      </div>

      {/* Body */}
      <div className="flex-1 space-y-3 p-4" style={{ backgroundColor: BODY_BG, color: INK }}>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Período" value={`${String(senior.semester).padStart(2, '0')}/12`} />
          <Stat label="Esforço" value={String(senior.effortScore)} />
          <Stat label="Pupilos" value={`${senior.activeMenteeCount}/${senior.maxMentees}`} />
        </div>

        {score !== undefined && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 border border-black/40">
              <div className="h-full bg-black" style={{ width: `${Math.round(score)}%` }} />
            </div>
            <span className="font-mono text-xs font-bold tabular-nums">{Math.round(score)}%</span>
          </div>
        )}

        {senior.tags.length > 0 && (
          <div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest opacity-60">
              Especializações
            </div>
            <div className="flex flex-wrap gap-1">
              {visibleTags.map((tag) => (
                <span
                  key={tag.id}
                  className="border border-black px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase"
                >
                  {tag.name}
                </span>
              ))}
              {extraTags > 0 && (
                <span className="border border-black px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase opacity-60">
                  +{extraTags}
                </span>
              )}
            </div>
          </div>
        )}

        {matchReasons && matchReasons.length > 0 && (
          <ul className="space-y-0.5 border-t border-black/20 pt-2">
            {matchReasons.slice(0, 2).map((reason) => (
              <li key={reason} className="font-mono text-[10px] uppercase opacity-70">
                ✦ {reason}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-stretch border-t-2 border-black" style={{ backgroundColor: HEADER_BG, color: INK }}>
        <div className="flex flex-1 items-center gap-1.5 px-3 py-2.5 font-mono text-xs font-bold tabular-nums">
          <Eye className="h-3.5 w-3.5" aria-hidden />
          {formatCount(senior.profileViews)}
        </div>
        {isFreshman && (
          <button
            type="button"
            disabled={bumping}
            onClick={(e) => {
              e.stopPropagation();
              onBump();
            }}
            className="flex items-center gap-1.5 px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-widest transition-colors"
            style={{
              backgroundColor: bumped ? HEADER_BG : INK,
              color: bumped ? INK : HEADER_BG,
              borderLeft: `2px solid ${INK}`,
            }}
          >
            {bumping ? '…' : bumped ? 'Impulso ✓' : (
              <>
                Impulsionar <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export function DiscoveryPage() {
  usePageMeta(
    'Descoberta de Padrinhos',
    'Explore os veteranos disponíveis, filtre por interesses e encontre seu padrinho acadêmico.',
  );
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

  const hasFilters = semester !== undefined || availability !== undefined || selectedTags.length > 0;

  const filterPanel = (
    <aside className="h-fit border-2 border-[#c9ced8]/40 p-4 lg:sticky lg:top-20">
      <h2 className="border-b border-[#c9ced8]/40 pb-2 font-mono text-xs font-bold uppercase tracking-[0.25em] text-foreground">
        Filtros
      </h2>

      <div className="mt-4">
        <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Período acadêmico
        </div>
        <ThemedSelect
          ariaLabel="Filtrar por período"
          value={semester ? String(semester) : ''}
          onChange={(v) => setSemester(v ? Number(v) : undefined)}
          options={[
            { value: '', label: 'Todos' },
            ...Array.from({ length: 12 }, (_, i) => i + 1).map((n) => ({
              value: String(n),
              label: `${String(n).padStart(2, '0')}/12`,
            })),
          ]}
        />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Disponibilidade
        </div>
        <div className="space-y-1">
          {([
            [undefined, 'Todos'],
            ['accepting', 'Aceitando pedidos'],
            ['full', 'Lotados'],
          ] as const).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setAvailability(value)}
              aria-pressed={availability === value}
              className={`flex w-full items-center gap-2 border-2 px-2 py-1.5 text-left font-mono text-[11px] uppercase tracking-wide ${
                availability === value
                  ? 'border-[#c9f24c] text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-[#c9ced8]/30'
              }`}
            >
              <span
                className={`inline-block h-2.5 w-2.5 border ${
                  availability === value ? 'border-[#c9f24c] bg-[#c9f24c]' : 'border-[#c9ced8]/60'
                }`}
                aria-hidden
              />
              {label}
            </button>
          ))}
        </div>
      </div>

      {groupedTags.length > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Interesses
          </div>
          <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
            {groupedTags.map(([category, tags]) => (
              <div key={category}>
                <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
                  {category}
                </div>
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => {
                    const active = selectedTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleTag(tag.id)}
                        className="border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase transition-colors"
                        style={{
                          borderColor: active ? '#c9f24c' : 'rgba(201,206,216,0.35)',
                          backgroundColor: active ? '#c9f24c' : 'transparent',
                          color: active ? '#000000' : 'inherit',
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={!hasFilters}
        onClick={() => {
          setSemester(undefined);
          setAvailability(undefined);
          setSelectedTags([]);
        }}
        className="mt-5 w-full border-2 border-[#c9ced8]/60 px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-foreground transition-colors hover:border-[#c9ced8] disabled:opacity-40"
      >
        Limpar filtros
      </button>
    </aside>
  );

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute inset-0 -mx-4 -my-8 opacity-[0.10]"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(#c9ced8 1px, transparent 1px), linear-gradient(90deg, #c9ced8 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 70% 50% at 50% 0%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 50% at 50% 0%, black 30%, transparent 100%)',
        }}
      />

      <div className="relative">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-mono text-xl font-bold uppercase tracking-[0.15em] text-foreground">
            Descoberta de Padrinhos
          </h1>
          {isFreshman && (
            <div className="flex border-2 border-[#c9ced8]/40">
              <button
                type="button"
                aria-pressed={!showRecommendations}
                onClick={() => setShowRecommendations(false)}
                className={`px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest ${
                  !showRecommendations ? 'bg-[#c9f24c] text-black' : 'text-muted-foreground'
                }`}
              >
                Catálogo
              </button>
              <button
                type="button"
                aria-pressed={showRecommendations}
                onClick={() => setShowRecommendations(true)}
                className={`px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest ${
                  showRecommendations ? 'bg-[#c9f24c] text-black' : 'text-muted-foreground'
                }`}
              >
                Sugeridos
              </button>
            </div>
          )}
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          {filterPanel}

          <div>
            {seniorsQuery.isLoading && (
              <div className="flex min-h-64 items-center justify-center border-2 border-dashed border-[#c9ced8]/30 p-10">
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  Buscando…
                </p>
              </div>
            )}

            {!seniorsQuery.isLoading && (seniorsQuery.data?.length ?? 0) === 0 && (
              <div
                className="flex min-h-64 flex-col items-center justify-center gap-2 border-2 border-dashed border-[#c9ced8]/30 p-10"
                role="status"
              >
                <p className="font-mono text-2xl font-bold uppercase tracking-widest text-muted-foreground">
                  NO_DATA
                </p>
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground/60">
                  Nenhum padrinho corresponde aos filtros…
                </p>
              </div>
            )}

            {seniorsQuery.data && seniorsQuery.data.length > 0 && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {seniorsQuery.data.map((senior) => {
                  const rec = senior as SeniorSummary & { score?: number; matchReasons?: string[] };
                  return (
                    <MentorCard
                      key={senior.userId}
                      senior={senior}
                      score={rec.score}
                      matchReasons={rec.matchReasons}
                      bumped={isBumped(senior.handle)}
                      bumping={bumpMutation.isPending && bumpMutation.variables === senior.handle}
                      isFreshman={isFreshman}
                      onOpen={() => setProfileModalHandle(senior.handle)}
                      onBump={() => handleBumpClick(senior.handle)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <MentorProfileModal
        open={profileModalHandle !== null}
        onOpenChange={(open) => !open && setProfileModalHandle(null)}
        seniorHandle={profileModalHandle ?? ''}
      />
    </div>
  );
}
