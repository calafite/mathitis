import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SeniorSummary, Tag } from '@mathitis/schemas';
import { useAuth } from '@/contexts/auth-context';
import { discoveryApi } from '@/lib/discovery-api';
import { requestsApi, buildIdempotencyKey } from '@/lib/requests-api';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';

function avatar(src: string | null, alt: string) {
  if (!src) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-xl font-bold text-indigo-700">
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
  onRequest,
  bumping,
  requested,
}: {
  senior: SeniorSummary;
  role?: string;
  score?: number;
  matchReasons?: string[];
  onBump: () => void;
  onRequest: (senior: SeniorSummary) => void;
  bumping: boolean;
  requested: boolean;
}) {
  const isFreshman = role === 'freshman';

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {avatar(senior.avatarThumbnailUrl, senior.socialName ?? senior.handle)}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              to={`/lineage/${senior.handle}`}
              className="truncate font-semibold text-slate-900 hover:underline"
            >
              {senior.socialName ?? senior.handle}
            </Link>
            {score !== undefined && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                {Math.round(score)}% match
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500">
            @{senior.handle} · Semester {senior.semester}
          </p>
        </div>
      </div>

      {senior.tagline && <p className="mt-2 text-sm text-slate-700">{senior.tagline}</p>}

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

      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span>💬 {senior.effortScore} effort</span>
        <span>👁 {senior.profileViews} views</span>
        <span>⬆ {senior.bumpCount} bumps</span>
        <span className={senior.isAcceptingRequests ? 'text-emerald-600' : 'text-slate-400'}>
          {senior.isAcceptingRequests ? 'Accepting requests' : 'Not accepting'}
        </span>
      </div>

      {matchReasons && matchReasons.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-slate-100 pt-2">
          {matchReasons.map((reason) => (
            <li key={reason} className="flex items-start gap-1.5 text-xs text-slate-600">
              <span aria-hidden className="mt-0.5 text-indigo-500">
                ✦
              </span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      )}

      {isFreshman && (
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={bumping}
            onClick={onBump}
            className="flex-1"
          >
            {bumping ? '…' : 'Bump'}
          </Button>
          <Button
            size="sm"
            disabled={!senior.isAcceptingRequests || requested}
            onClick={() => onRequest(senior)}
            className="flex-1"
          >
            {requested ? 'Requested' : 'Request'}
          </Button>
        </div>
      )}
    </div>
  );
}

export function DiscoveryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [semester, setSemester] = useState<number | undefined>(undefined);
  const [availability, setAvailability] = useState<'accepting' | 'full' | undefined>(undefined);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [requestTarget, setRequestTarget] = useState<SeniorSummary | null>(null);
  const [message, setMessage] = useState('');
  const [requestError, setRequestError] = useState<string | null>(null);
  const [bumpedSet, setBumpedSet] = useState<Set<string>>(new Set());
  const [requestedSet, setRequestedSet] = useState<Set<string>>(new Set());

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

  const requestMutation = useMutation({
    mutationFn: async ({ handle, text }: { handle: string; text: string }) => {
      const response = await requestsApi.create(
        { seniorHandle: handle, message: text },
        buildIdempotencyKey(),
      );
      return response;
    },
    onSuccess: (_data, variables) => {
      setRequestedSet((prev) => new Set(prev).add(variables.handle));
      setRequestTarget(null);
      setMessage('');
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

  const submitRequest = () => {
    if (!requestTarget) return;
    setRequestError(null);
    requestMutation.mutate(
      { handle: requestTarget.handle, text: message },
      {
        onError: (error) => {
          setRequestError(error instanceof ApiError ? error.message : 'Request failed');
        },
      },
    );
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
          <h1 className="text-2xl font-bold text-foreground">Discovery</h1>
        </div>
        <div className="flex items-center gap-3">
          {isFreshman && (
            <Button variant="outline" size="sm" onClick={() => setShowRecommendations((v) => !v)}>
              {showRecommendations ? 'Show catalog' : 'Show recommendations'}
            </Button>
          )}
          <Link
            to="/settings"
            className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-muted-foreground dark:hover:text-foreground"
          >
            Settings
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={semester ?? ''}
          onChange={(e) => setSemester(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All semesters</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((s) => (
            <option key={s} value={s}>
              Semester {s}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          value={availability ?? ''}
          onChange={(e) =>
            setAvailability(e.target.value ? (e.target.value as 'accepting' | 'full') : undefined)
          }
        >
          <option value="">Any availability</option>
          <option value="accepting">Accepting requests</option>
          <option value="full">At capacity</option>
        </select>
        {groupedTags.map(([category, tags]) => (
          <div
            key={category}
            className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5"
          >
            <span className="text-xs font-medium text-slate-500">{category}</span>
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`rounded-full px-2 py-0.5 text-xs ${
                  selectedTags.includes(tag.id)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        ))}
      </div>

      {requestError && <p className="mt-4 text-sm text-red-600">{requestError}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {seniorsQuery.isLoading && <p className="text-slate-500">Loading…</p>}
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
            onRequest={(s) => setRequestTarget(s)}
            bumping={bumpMutation.isPending || removeBumpMutation.isPending}
            requested={requestedSet.has(senior.handle)}
          />
        ))}
      </div>

      {requestTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onClick={() => setRequestTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-dialog-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="request-dialog-title" className="text-lg font-semibold text-slate-900">
              Request mentorship from {requestTarget.socialName ?? requestTarget.handle}
            </h2>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              placeholder="Introduce yourself and explain what you would like to work on together…"
              className="mt-3 w-full rounded-md border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRequestTarget(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => void submitRequest()}
                disabled={requestMutation.isPending || !message.trim()}
              >
                {requestMutation.isPending ? 'Sending…' : 'Send request'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
