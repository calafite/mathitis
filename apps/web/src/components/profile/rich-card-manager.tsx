import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateRichCardBody, RichCard, RichCardType } from '@mathitis/schemas';
import { profileApi } from '@/lib/profile-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CARD_TYPES: Array<{ value: RichCardType; label: string }> = [
  { value: 'song', label: 'Song' },
  { value: 'game', label: 'Game' },
  { value: 'film', label: 'Film' },
  { value: 'book', label: 'Book' },
  { value: 'project', label: 'Project' },
  { value: 'custom', label: 'Custom' },
];

interface CardFormState {
  cardType: RichCardType;
  title: string;
  subtitle: string;
  description: string;
  embedUrl: string;
  externalUrl: string;
  imageUrl: string;
  accentColor: string;
  metadata: Record<string, string>;
}

function emptyForm(): CardFormState {
  return {
    cardType: 'song',
    title: '',
    subtitle: '',
    description: '',
    embedUrl: '',
    externalUrl: '',
    imageUrl: '',
    accentColor: '#6366f1',
    metadata: {},
  };
}

function cardToForm(card: RichCard): CardFormState {
  const meta = (card.metadata ?? {}) as Record<string, unknown>;
  return {
    cardType: card.cardType,
    title: card.title,
    subtitle: card.subtitle ?? '',
    description: card.description ?? '',
    embedUrl: card.embedUrl ?? '',
    externalUrl: card.externalUrl ?? '',
    imageUrl: card.imageUrl ?? '',
    accentColor: card.accentColor,
    metadata: Object.fromEntries(
      Object.entries(meta).map(([key, value]) => [key, String(value ?? '')]),
    ),
  };
}

function buildPayload(form: CardFormState): CreateRichCardBody {
  return {
    cardType: form.cardType,
    title: form.title,
    subtitle: form.subtitle || null,
    description: form.description || null,
    embedUrl: form.embedUrl || null,
    externalUrl: form.externalUrl || null,
    imageUrl: form.imageUrl || null,
    accentColor: form.accentColor,
    metadata: Object.fromEntries(
      Object.entries(form.metadata).filter(([, value]) => value.trim() !== ''),
    ),
  };
}

function MetadataFields({
  form,
  onChange,
}: {
  form: CardFormState;
  onChange: (next: CardFormState) => void;
}) {
  function setMeta(key: string, value: string) {
    onChange({ ...form, metadata: { ...form.metadata, [key]: value } });
  }

  if (form.cardType === 'song') {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Artist (optional)</label>
        <Input value={form.metadata['artistName'] ?? ''} onChange={(e) => setMeta('artistName', e.target.value)} placeholder="Radiohead" />
      </div>
    );
  }
  if (form.cardType === 'game') {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Steam App ID</label>
        <Input value={form.metadata['steamAppId'] ?? ''} onChange={(e) => setMeta('steamAppId', e.target.value)} placeholder="1245620" />
      </div>
    );
  }
  if (form.cardType === 'film') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Rating (0-10)</label>
          <Input type="number" min={0} max={10} step={0.1} value={form.metadata['rating'] ?? ''} onChange={(e) => setMeta('rating', e.target.value)} placeholder="8.5" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Year</label>
          <Input value={form.metadata['year'] ?? ''} onChange={(e) => setMeta('year', e.target.value)} placeholder="2024" />
        </div>
      </div>
    );
  }
  if (form.cardType === 'project') {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-600">Tech stack (comma separated)</label>
        <Input value={form.metadata['techStackCsv'] ?? ''} onChange={(e) => setMeta('techStackCsv', e.target.value)} placeholder="Python, NumPy, LaTeX" />
      </div>
    );
  }
  return null;
}

function CardForm({
  initial,
  saving,
  onSubmit,
  onCancel,
}: {
  initial: CardFormState;
  saving: boolean;
  onSubmit: (payload: CreateRichCardBody) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<CardFormState>(initial);

  function submit() {
    const payload = buildPayload(form);
    if (form.cardType === 'project') {
      const csv = form.metadata['techStackCsv'] ?? '';
      payload.metadata = {
        techStack: csv.split(',').map((item) => item.trim()).filter(Boolean),
      };
    }
    onSubmit(payload);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Type</label>
          <select
            value={form.cardType}
            onChange={(e) => setForm({ ...form, cardType: e.target.value as RichCardType })}
            className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
          >
            {CARD_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Title *</label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Card title" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Subtitle</label>
          <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Optional subtitle" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Accent colour</label>
          <input
            type="color"
            value={form.accentColor}
            onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
            className="h-10 w-full cursor-pointer rounded-md border border-input bg-white"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={2}
            className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Embed URL <span className="text-slate-400">(Spotify / SoundCloud / YouTube / Vimeo)</span>
          </label>
          <Input value={form.embedUrl} onChange={(e) => setForm({ ...form, embedUrl: e.target.value })} placeholder="https://open.spotify.com/embed/track/…" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">External URL</label>
          <Input value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://store.steampowered.com/app/…" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Image URL</label>
          <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" />
        </div>
        <div className="sm:col-span-2">
          <MetadataFields form={form} onChange={setForm} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={saving || !form.title.trim()} onClick={submit}>
          {saving ? 'Saving…' : 'Save card'}
        </Button>
      </div>
    </div>
  );
}

export function RichCardManager() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RichCard | 'new' | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const cardsQuery = useQuery({
    queryKey: ['profile', 'cards'],
    queryFn: () => profileApi.listCards().then((r) => r.cards),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['profile', 'cards'] }),
      queryClient.invalidateQueries({ queryKey: ['profile', 'me'] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: (input: CreateRichCardBody) => profileApi.createCard(input),
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: CreateRichCardBody }) => profileApi.updateCard(id, input),
    onSuccess: async () => {
      setEditing(null);
      await invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => profileApi.deleteCard(id),
    onSuccess: () => void invalidate(),
  });

  const reorderMutation = useMutation({
    mutationFn: (order: string[]) => profileApi.reorderCards(order),
    onSuccess: () => void invalidate(),
  });

  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data]);

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const next = [...cards];
    const moved = next.splice(dragIndex, 1)[0];
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    setDragIndex(null);
    queryClient.setQueryData(['profile', 'cards'], { cards: next });
    reorderMutation.mutate(next.map((card) => card.id));
  }

  function moveCard(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= cards.length) return;
    const next = [...cards];
    const moved = next.splice(index, 1)[0];
    if (!moved) return;
    next.splice(targetIndex, 0, moved);
    queryClient.setQueryData(['profile', 'cards'], { cards: next });
    reorderMutation.mutate(next.map((card) => card.id));
  }

  if (cardsQuery.isLoading) {
    return <p className="text-sm text-slate-500">Loading cards…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {cards.length} card{cards.length === 1 ? '' : 's'} — drag to reorder
        </p>
        <Button type="button" size="sm" onClick={() => setEditing('new')}>
          Add card
        </Button>
      </div>

      {editing === 'new' ? (
        <CardForm
          initial={emptyForm()}
          saving={createMutation.isPending}
          onSubmit={(payload) => createMutation.mutate(payload)}
          onCancel={() => setEditing(null)}
        />
      ) : null}

      <ul className="space-y-2">
        {cards.map((card, index) => (
          <li
            key={card.id}
            draggable={editing === null}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(index)}
            className="flex cursor-grab items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            {editing === card ? (
              <div className="w-full">
                <CardForm
                  initial={cardToForm(card)}
                  saving={updateMutation.isPending}
                  onSubmit={(payload) => updateMutation.mutate({ id: card.id, input: payload })}
                  onCancel={() => setEditing(null)}
                />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-slate-300" aria-hidden>⠿</span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{card.title}</p>
                    <p className="text-xs capitalize text-slate-500">{card.cardType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={index === 0}
                    onClick={() => moveCard(index, -1)}
                    className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={index === cards.length - 1}
                    onClick={() => moveCard(index, 1)}
                    className="rounded px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(card)}>
                    Edit
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => deleteMutation.mutate(card.id)}>
                    Delete
                  </Button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}