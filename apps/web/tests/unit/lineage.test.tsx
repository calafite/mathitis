import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { LineageEdge, LineageNode, LineageResponse } from '@mathitis/schemas';
import { LineagePage } from '@/pages/lineage';
import { lineageApi } from '@/lib/lineage-api';

vi.mock('@/lib/lineage-api', () => ({
  lineageApi: {
    all: vi.fn(),
    forHandle: vi.fn(),
  },
}));

const mockedApi = vi.mocked(lineageApi);

const YEARS = ['2021/2022', '2022/2023', '2023/2024', '2024/2025', '2025/2026'];

const NODE_NAMES = [
  'Ana',
  'Bruno',
  'Carla',
  'Diego',
  'Elisa',
  'Felipe',
  'Gabi',
  'Heitor',
  'Ivo',
  'Julia',
];

function node(index: number): LineageNode {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    handle: `user${index}`,
    socialName: NODE_NAMES[index],
    semester: (index % 12) + 1,
    role: index === 0 ? 'freshman' : 'senior',
  };
}

function edge(from: number, to: number, year: string): LineageEdge {
  return {
    mentorId: node(from).id,
    menteeId: node(to).id,
    academicYear: year,
    semester: 1,
  };
}

function buildGraph(): LineageResponse {
  const nodes = NODE_NAMES.map((_, i) => node(i));
  const edges: LineageEdge[] = [
    edge(0, 1, YEARS[0]),
    edge(0, 2, YEARS[0]),
    edge(1, 3, YEARS[1]),
    edge(2, 4, YEARS[1]),
    edge(3, 5, YEARS[2]),
    edge(4, 6, YEARS[2]),
    edge(5, 7, YEARS[3]),
    edge(6, 8, YEARS[3]),
    edge(7, 9, YEARS[4]),
  ];
  return { nodes, edges, academicYears: [...YEARS] };
}

function buildSmallGraph(): LineageResponse {
  const nodes = [node(0), node(1), node(2)];
  const edges = [edge(0, 1, '2024/2025'), edge(1, 2, '2025/2026')];
  return { nodes, edges, academicYears: ['2024/2025', '2025/2026'] };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LineagePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function expectVisible(names: string[]) {
  for (const name of NODE_NAMES) {
    const matcher = screen.queryByText(name);
    if (names.includes(name)) {
      expect(matcher, `esperava "${name}" visível`).toBeInTheDocument();
    } else {
      expect(matcher, `não esperava "${name}" visível`).not.toBeInTheDocument();
    }
  }
}

describe('LineagePage year filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.all.mockResolvedValue(buildGraph());
    mockedApi.forHandle.mockResolvedValue(buildGraph());
  });

  it('renders only the two most recent academic years by default', async () => {
    renderPage();

    await screen.findByText('Filtro de Ano Acadêmico');
    await expectVisible(['Felipe', 'Gabi', 'Heitor', 'Ivo', 'Julia']);
  });

  it('shows only the selected year when a single year is clicked', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Filtro de Ano Acadêmico');
    await user.click(screen.getByRole('button', { name: '2023/2024' }));

    await expectVisible(['Diego', 'Elisa', 'Felipe', 'Gabi']);
  });

  it('renders all nodes and the warning when full history is loaded', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Filtro de Ano Acadêmico');
    expect(screen.queryByText(/Aviso: Carregar a linhagem completa/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Carregar Histórico Completo' }));

    await expectVisible(NODE_NAMES);
    expect(screen.getByRole('note')).toHaveTextContent(
      'Aviso: Carregar a linhagem completa de todos os anos pode causar lentidão em dispositivos mais antigos.',
    );
  });

  it('hides filter controls and renders everything when there are at most 2 years', async () => {
    mockedApi.all.mockResolvedValue(buildSmallGraph());
    renderPage();

    await screen.findByText('Ana');
    expect(screen.queryByText('Filtro de Ano Acadêmico')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Carregar Histórico Completo' }),
    ).not.toBeInTheDocument();
    await expectVisible(NODE_NAMES.slice(0, 3));
  });

  it('disables transitions on the SVG when rendering more than 500 nodes', async () => {
    const bigNodes: LineageNode[] = Array.from({ length: 501 }, (_, i) => ({
      ...node(i % NODE_NAMES.length),
      id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      socialName: i < NODE_NAMES.length ? NODE_NAMES[i] : `P${i}`,
    }));
    const bigEdges: LineageEdge[] = [];
    for (let i = 0; i < 500; i++) {
      bigEdges.push({
        mentorId: bigNodes[i].id,
        menteeId: bigNodes[i + 1].id,
        academicYear: YEARS[YEARS.length - 1],
        semester: 1,
      });
    }
    mockedApi.all.mockResolvedValue({
      nodes: bigNodes,
      edges: bigEdges,
      academicYears: [...YEARS],
    });

    renderPage();
    await screen.findByText('Ana');

    const svg = document.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.style.transition).toBe('none');
  });
});
