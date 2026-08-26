import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import type { CreateRichCardBody, RichCard, RichCardType, ScrapedCardResponse } from '@mathitis/schemas';
import { ApiError } from '@/lib/api';
import { profileApi } from '@/lib/profile-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CARD_TYPES: Array<{ value: RichCardType; label: string }> = [
  { value: 'song', label: 'Música' },
  { value: 'game', label: 'Jogo' },
  { value: 'film', label: 'Filme' },
  { value: 'book', label: 'Livro' },
  { value: 'project', label: 'Projeto' },
  { value: 'custom', label: 'Personalizado' },
];

interface CardFormState {
  cardType: RichCardType;
  title: string;
  subtitle: string;
  description: string;
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
    externalUrl: card.externalUrl ?? '',
    imageUrl: card.imageUrl ?? '',
    accentColor: card.accentColor,
    metadata: Object.fromEntries(
      Object.entries(meta).map(([key, value]) => [key, String(value ?? '')]),
    ),
  };
}

function scrapedToForm(scraped: ScrapedCardResponse): CardFormState {
  const meta = (scraped.metadata ?? {}) as Record<string, unknown>;
  return {
    cardType: scraped.cardType,
    title: scraped.title,
    subtitle: scraped.subtitle ?? '',
    description: scraped.description ?? '',
    externalUrl: scraped.externalUrl ?? '',
    imageUrl: scraped.imageUrl ?? '',
    accentColor: scraped.accentColor,
    metadata: Object.fromEntries(
      Object.entries(meta).map(([key, value]) => [key, String(value ?? '')]),
    ),
  };
}

function providerFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.endsWith('spotify.com')) return 'Spotify';
    if (host.endsWith('steampowered.com')) return 'Steam';
    if (host === 'github.com' || host.endsWith('.github.com')) return 'GitHub';
    if (host.endsWith('letterboxd.com')) return 'Letterboxd';
    if (host.endsWith('openlibrary.org')) return 'OpenLibrary';
    return 'Link';
  } catch {
    return 'Link';
  }
}

const SCRAPE_FALLBACK_ERROR = 'Este link contém conteúdo impróprio ou não pôde ser lido';

function buildPayload(form: CardFormState): CreateRichCardBody {
  return {
    cardType: form.cardType,
    title: form.title,
    subtitle: form.subtitle || null,
    description: form.description || null,
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
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Artista (opcional)</label>
        <Input value={form.metadata['artistName'] ?? ''} onChange={(e) => setMeta('artistName', e.target.value)} placeholder="Mutantes" />
      </div>
    );
  }
  if (form.cardType === 'game') {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Steam App ID</label>
        <Input value={form.metadata['steamAppId'] ?? ''} onChange={(e) => setMeta('steamAppId', e.target.value)} placeholder="1245620" />
      </div>
    );
  }
  if (form.cardType === 'film') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Avaliação (0-10)</label>
          <Input type="number" min={0} max={10} step={0.1} value={form.metadata['rating'] ?? ''} onChange={(e) => setMeta('rating', e.target.value)} placeholder="8.5" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Ano</label>
          <Input value={form.metadata['year'] ?? ''} onChange={(e) => setMeta('year', e.target.value)} placeholder="2024" />
        </div>
      </div>
    );
  }
  if (form.cardType === 'project') {
    return (
      <div>
        <label className="mb-1 block text-xs font-medium text-muted-foreground">Stack técnica (separada por vírgulas)</label>
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
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);
  const [scrapeError, setScrapeError] = useState<string | null>(null);

  const scrapeMutation = useMutation({
    mutationFn: profileApi.scrapeCard,
    onSuccess: (scraped, url) => {
      setForm(scrapedToForm(scraped));
      setDetectedProvider(providerFromUrl(url));
      setScrapeError(null);
    },
    onError: (error: unknown) => {
      setDetectedProvider(null);
      setScrapeError(
        error instanceof ApiError && error.message ? error.message : SCRAPE_FALLBACK_ERROR,
      );
    },
  });

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
    <div className="rounded-lg border border-border bg-muted p-4">
      <div className="mb-4 border-2 border-white/15 p-3">
        <label className="mb-1 block font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Preenchimento Automático via Link
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={scrapeUrl}
            onChange={(e) => setScrapeUrl(e.target.value)}
            placeholder="Cole um link do Spotify, Steam, GitHub, Letterboxd ou Livro..."
            disabled={scrapeMutation.isPending}
          />
          <button
            type="button"
            onClick={() => scrapeMutation.mutate(scrapeUrl.trim())}
            disabled={scrapeMutation.isPending || scrapeUrl.trim().length === 0}
            className="flex shrink-0 items-center justify-center gap-2 border-2 border-[#c9f24c] bg-[#c9f24c] px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest text-black transition-colors hover:bg-transparent hover:text-[#c9f24c] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scrapeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            Autocompletar
          </button>
        </div>
        {detectedProvider ? (
          <p
            role="status"
            className="mt-2 inline-block border-2 border-[#c9f24c] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#c9f24c]"
          >
            ✓ {detectedProvider} detectado
          </p>
        ) : null}
        {scrapeError ? (
          <p role="alert" className="mt-2 border-l-2 border-red-500 pl-3 text-xs text-red-400">
            {scrapeError}
          </p>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Tipo</label>
          <select
            value={form.cardType}
            onChange={(e) => setForm({ ...form, cardType: e.target.value as RichCardType })}
            className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm"
          >
            {CARD_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Título *</label>
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título do cartão" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Subtítulo</label>
          <Input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Subtítulo opcional" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Cor de destaque</label>
          <input
            type="color"
            value={form.accentColor}
            onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
            className="h-10 w-full cursor-pointer rounded-md border border-input bg-card"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">URL externa</label>
          <Input value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} placeholder="https://store.steampowered.com/app/…" />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">URL da imagem</label>
          <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://…" />
        </div>
        <div className="sm:col-span-2">
          <MetadataFields form={form} onChange={setForm} />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" disabled={saving || !form.title.trim()} onClick={submit}>
          {saving ? 'Salvando…' : 'Salvar cartão'}
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
    return <p className="text-sm text-muted-foreground">Carregando cartões…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cards.length} cartão{cards.length === 1 ? '' : 's'}; arraste para reordenar
        </p>
        <Button type="button" size="sm" onClick={() => setEditing('new')}>
          Adicionar cartão
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
            className="flex cursor-grab items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
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
                  <span className="text-muted-foreground" aria-hidden>⠿</span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{card.title}</p>
                    <p className="text-xs capitalize text-muted-foreground">{card.cardType}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Mover para cima"
                    disabled={index === 0}
                    onClick={() => moveCard(index, -1)}
                    className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Mover para baixo"
                    disabled={index === cards.length - 1}
                    onClick={() => moveCard(index, 1)}
                    className="rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(card)}>
                    Editar
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => deleteMutation.mutate(card.id)}>
                    Excluir
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
