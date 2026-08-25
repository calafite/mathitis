import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { LineageEdge, LineageNode } from '@mathitis/schemas';
import { lineageApi } from '@/lib/lineage-api';
import { usePageMeta } from '@/lib/use-page-meta';

interface Position {
  x: number;
  y: number;
}

function computeLayout(nodes: LineageNode[], edges: LineageEdge[]): Map<string, Position> {
  const positions = new Map<string, Position>();
  if (nodes.length === 0) return positions;

  const rank = new Map<string, number>();

  const rankFor = (id: string): number => {
    const cached = rank.get(id);
    if (cached !== undefined) return cached;
    const isMentee = edges.filter((edge) => edge.menteeId === id);
    if (isMentee.length === 0) {
      rank.set(id, 0);
      return 0;
    }
    const depth = 1 + Math.max(...isMentee.map((edge) => rankFor(edge.mentorId)));
    rank.set(id, depth);
    return depth;
  };

  for (const node of nodes) {
    void rankFor(node.id);
  }

  const rankIndex = new Map<string, number>();
  for (const node of nodes) {
    const r = rank.get(node.id) ?? 0;
    const index = rankIndex.get(node.id) ?? 0;
    positions.set(node.id, { x: 60 + index * 180, y: 60 + r * 150 });
    rankIndex.set(node.id, index + 1);
  }

  return positions;
}

const ROOT_YEAR_MARKER = 'Raiz';
const YEAR_COLORS = ['#6366f1', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed'];
const HEAVY_RENDER_NODE_LIMIT = 500;
const FULL_HISTORY_WARNING =
  'Aviso: Carregar a linhagem completa de todos os anos pode causar lentidão em dispositivos mais antigos.';

function yearForRank(edges: LineageEdge[], rank: number, positions: Map<string, Position>): string {
  const years = edges
    .filter((edge) => {
      const pos = positions.get(edge.menteeId);
      return pos !== undefined && Math.round((pos.y - 60) / 150) === rank;
    })
    .map((edge) => edge.academicYear);
  return years.length > 0 ? [...new Set(years)].sort().join(' / ') : ROOT_YEAR_MARKER;
}

export function LineagePage() {
  usePageMeta('Linhagem', 'A árvore genealógica de mentorias do CI, turma a turma.');
  const { handle } = useParams<{ handle?: string }>();

  const lineageQuery = useQuery({
    queryKey: ['lineage', handle ?? 'all'],
    queryFn: () => (handle ? lineageApi.forHandle(handle) : lineageApi.all()),
  });

  const academicYears = useMemo(
    () => [...(lineageQuery.data?.academicYears ?? [])].sort(),
    [lineageQuery.data],
  );
  const showYearFilter = academicYears.length > 2;
  const defaultYears = useMemo(() => academicYears.slice(-2), [academicYears]);

  // null = default (two most recent years); 'all' = full history; otherwise a single year.
  const [yearSelection, setYearSelection] = useState<string[] | 'all' | null>(null);

  const selectYear = (year: string) => {
    setYearSelection((prev) =>
      prev !== 'all' && prev?.length === 1 && prev[0] === year ? null : [year],
    );
  };

  const loadFullHistory = () => setYearSelection('all');

  const isYearActive = (year: string) => {
    if (yearSelection === 'all') return false;
    const selected = yearSelection ?? defaultYears;
    return selected.includes(year);
  };
  const isFullHistoryActive = yearSelection === 'all';

  const { nodes, edges, positions, ranks } = useMemo(() => {
    const data = lineageQuery.data;
    if (!data) return { nodes: [], edges: [], positions: new Map<string, Position>(), ranks: 0 };
    const allPositions = computeLayout(data.nodes, data.edges);

    let visibleEdges = data.edges;
    if (yearSelection !== 'all') {
      const years = new Set(yearSelection ?? defaultYears);
      visibleEdges = data.edges.filter((edge) => years.has(edge.academicYear));
    }

    const visibleIds = new Set<string>();
    for (const edge of visibleEdges) {
      visibleIds.add(edge.mentorId);
      visibleIds.add(edge.menteeId);
    }
    const visibleNodes = data.nodes.filter((node) => visibleIds.has(node.id));

    const positions = new Map<string, Position>();
    for (const node of visibleNodes) {
      const pos = allPositions.get(node.id);
      if (pos) positions.set(node.id, pos);
    }
    const ranks = visibleNodes.reduce(
      (max, node) => Math.max(max, Math.round(((positions.get(node.id)?.y ?? 60) - 60) / 150)),
      0,
    );
    return { nodes: visibleNodes, edges: visibleEdges, positions, ranks };
  }, [lineageQuery.data, yearSelection, defaultYears]);

  const width = 100 + Math.max(nodes.length, 1) * 180;
  const height = 120 + (ranks + 1) * 150;
  const heavyRender = nodes.length > HEAVY_RENDER_NODE_LIMIT;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="font-mono text-xl font-bold uppercase tracking-[0.15em] text-foreground">Linhagem de apadrinhamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {handle ? `Subgrafo com raiz em @${handle}` : 'A linhagem completa do CI ao longo dos anos acadêmicos.'}
        </p>
      </header>

      {showYearFilter && (
        <div
          role="group"
          aria-label="Filtro de Ano Acadêmico"
          className="mb-6 border-2 border-[#c9ced8]/40 p-3"
        >
          <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Filtro de Ano Acadêmico
          </div>
          <div className="flex flex-wrap gap-1.5">
            {academicYears.map((year) => {
              const active = isYearActive(year);
              return (
                <button
                  key={year}
                  type="button"
                  aria-pressed={active}
                  onClick={() => selectYear(year)}
                  className="border-2 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    borderColor: active ? '#c9f24c' : 'rgba(201,206,216,0.4)',
                    backgroundColor: active ? '#c9f24c' : 'transparent',
                    color: active ? '#000000' : undefined,
                  }}
                >
                  {year}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={isFullHistoryActive}
              onClick={loadFullHistory}
              className="border-2 px-2 py-1 font-mono text-[11px] font-bold uppercase tracking-widest transition-colors"
              style={{
                borderColor: isFullHistoryActive ? '#c9f24c' : 'rgba(201,206,216,0.4)',
                backgroundColor: isFullHistoryActive ? '#c9f24c' : 'transparent',
                color: isFullHistoryActive ? '#000000' : undefined,
              }}
            >
              Carregar Histórico Completo
            </button>
          </div>
          {isFullHistoryActive && (
            <p role="note" className="mt-2 text-xs text-muted-foreground">
              {FULL_HISTORY_WARNING}
            </p>
          )}
        </div>
      )}

      {lineageQuery.isLoading && <p className="mt-4 text-muted-foreground">Carregando…</p>}
      {!lineageQuery.isLoading && nodes.length === 0 && (
        <p className="mt-4 text-muted-foreground">Nenhum apadrinhamento registrado ainda.</p>
      )}

      {nodes.length > 0 && (
        <div
          className={`mt-6 overflow-x-auto border-2 border-white/15 bg-card p-4${
            heavyRender ? ' [&_*]:transition-none [&_*]:animate-none' : ''
          }`}
        >
          <svg
            width={width}
            height={height}
            className="block"
            style={heavyRender ? { transition: 'none', animation: 'none' } : undefined}
          >
            {edges.map((edge, index) => {
              const from = positions.get(edge.mentorId);
              const to = positions.get(edge.menteeId);
              if (!from || !to) return null;
              const rank = Math.round((to.y - 60) / 150);
              const color = YEAR_COLORS[rank % YEAR_COLORS.length];
              return (
                <line
                  key={index}
                  x1={from.x}
                  y1={from.y + 22}
                  x2={to.x}
                  y2={to.y - 22}
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.6}
                />
              );
            })}
            {Array.from({ length: ranks + 1 }, (_, rank) => {
              const year = yearForRank(edges, rank, positions);
              const y = 60 + rank * 150;
              return (
                <text
                  key={rank}
                  x={10}
                  y={y + 4}
                  fontSize={11}
                  className="fill-muted-foreground"
                  fontWeight="600"
                >
                  {year}
                </text>
              );
            })}
            {nodes.map((node) => {
              const pos = positions.get(node.id);
              if (!pos) return null;
              const rank = Math.round((pos.y - 60) / 150);
              const color = YEAR_COLORS[rank % YEAR_COLORS.length];
              return (
                <g key={node.id}>
                  <circle cx={pos.x} cy={pos.y} r={22} fill={color} opacity={0.15} />
                  <circle cx={pos.x} cy={pos.y} r={16} fill={color} />
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight="700"
                    fill="#ffffff"
                  >
                    {(node.socialName ?? node.handle).charAt(0).toUpperCase()}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + 38}
                    textAnchor="middle"
                    fontSize={11}
                    className="fill-foreground"
                  >
                    {node.socialName ?? node.handle}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + 52}
                    textAnchor="middle"
                    fontSize={10}
                    className="fill-muted-foreground"
                  >
                    @{node.handle} · S{node.semester}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}
