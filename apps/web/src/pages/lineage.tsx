import { useMemo } from 'react';
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
  usePageMeta('Linhagem', 'A árvore genealógica de mentorias do departamento, turma a turma.');
  const { handle } = useParams<{ handle?: string }>();

  const lineageQuery = useQuery({
    queryKey: ['lineage', handle ?? 'all'],
    queryFn: () => (handle ? lineageApi.forHandle(handle) : lineageApi.all()),
  });

  const { nodes, edges, positions, ranks } = useMemo(() => {
    const data = lineageQuery.data;
    if (!data) return { nodes: [], edges: [], positions: new Map<string, Position>(), ranks: 0 };
    const positions = computeLayout(data.nodes, data.edges);
    const ranks = data.nodes.reduce(
      (max, node) => Math.max(max, Math.round((positions.get(node.id)?.y ?? 60 - 60) / 150)),
      0,
    );
    return { nodes: data.nodes, edges: data.edges, positions, ranks };
  }, [lineageQuery.data]);

  const width = 100 + Math.max(nodes.length, 1) * 180;
  const height = 120 + (ranks + 1) * 150;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Linhagem de apadrinhamento</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {handle ? `Subgrafo com raiz em @${handle}` : 'A linhagem completa do departamento ao longo dos anos acadêmicos.'}
        </p>
      </header>

      {lineageQuery.isLoading && <p className="mt-4 text-muted-foreground">Carregando…</p>}
      {!lineageQuery.isLoading && nodes.length === 0 && (
        <p className="mt-4 text-muted-foreground">Nenhum apadrinhamento registrado ainda.</p>
      )}

      {nodes.length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-card p-4">
          <svg width={width} height={height} className="block">
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