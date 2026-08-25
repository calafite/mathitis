import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MentorshipRepository } from '../../src/repositories/mentorship-repository.js';
import { createLineageService } from '../../src/services/lineage-service.js';
import { invalidateLineageCache, lineageFullGraphKey, lineageSubgraphKey } from '../../src/lib/lineage-cache.js';

/** In-memory Redis stand-in with SETEX/GET/DEL semantics. */
function memoryRedis() {
  const store = new Map<string, string>();
  const calls: string[] = [];
  return {
    calls,
    async get(key: string) {
      calls.push(`GET ${key}`);
      return store.get(key) ?? null;
    },
    async set(key: string, value: string, mode: 'EX', ttl: number) {
      calls.push(`SETEX ${key} ${ttl}`);
      if (mode !== 'EX') throw new Error('only EX supported');
      store.set(key, value);
      return 'OK';
    },
    async del(...keys: string[]) {
      calls.push(`DEL ${keys.join(',')}`);
      let n = 0;
      for (const key of keys) {
        if (store.delete(key)) n += 1;
      }
      return n;
    },
    dump: () => store,
  };
}

const ROWS = [
  {
    mentorId: 'm1',
    mentor: { handle: 'ada', socialName: 'Ada', semester: 8, role: 'senior' },
    menteeId: 'f1',
    mentee: { handle: 'alan', socialName: 'Alan', semester: 2, role: 'freshman' },
    academicYear: '2025/2026',
    semester: 1,
  },
  {
    mentorId: 'm2',
    mentor: { handle: 'grace', socialName: 'Grace', semester: 9, role: 'senior' },
    menteeId: 'f2',
    mentee: { handle: 'linus', socialName: 'Linus', semester: 3, role: 'freshman' },
    academicYear: '2024/2025',
    semester: 2,
  },
];

function makeRepo(): MentorshipRepository & { listLineage: ReturnType<typeof vi.fn> } {
  return { listLineage: vi.fn().mockResolvedValue(ROWS) } as never;
}

describe('lineage service cache', () => {
  let redis: ReturnType<typeof memoryRedis>;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(() => {
    redis = memoryRedis();
    repo = makeRepo();
  });

  it('returns the graph from the database and writes it back with a 24h TTL on cache miss', async () => {
    const service = createLineageService(repo as MentorshipRepository, redis);
    const graph = await service.getFullGraph();

    expect(graph.nodes).toHaveLength(4);
    expect(repo.listLineage).toHaveBeenCalledTimes(1);
    expect(redis.calls.some((c) => c.startsWith(`SETEX ${lineageFullGraphKey()} 86400`))).toBe(true);
    expect(redis.dump().get(lineageFullGraphKey())).toContain('ada');
  });

  it('serves the full graph from the cache without hitting the database', async () => {
    const service = createLineageService(repo as MentorshipRepository, redis);
    await service.getFullGraph(); // populate
    expect(repo.listLineage).toHaveBeenCalledTimes(1);

    repo.listLineage.mockClear();
    const cached = await service.getFullGraph();
    expect(repo.listLineage).not.toHaveBeenCalled();
    expect(cached.nodes).toHaveLength(4);
  });

  it('caches handle-scoped subgraphs under lineage:subgraph:{handle}', async () => {
    const service = createLineageService(repo as MentorshipRepository, redis);
    const sub = await service.getSubgraph('ada');

    expect(sub.nodes.map((n) => n.handle).sort()).toEqual(['ada', 'alan']);
    expect(redis.dump().has(lineageSubgraphKey('ada'))).toBe(true);

    repo.listLineage.mockClear();
    const cached = await service.getSubgraph('ada');
    expect(repo.listLineage).not.toHaveBeenCalled();
    expect(cached.nodes).toHaveLength(2);
  });

  it('falls back to the database when the cache contains garbage', async () => {
    redis.dump().set(lineageFullGraphKey(), 'not-json{');
    const service = createLineageService(repo as MentorshipRepository, redis);
    const graph = await service.getFullGraph();
    expect(graph.nodes).toHaveLength(4);
    expect(repo.listLineage).toHaveBeenCalledTimes(1);
  });

  it('works without a cache store (no-op)', async () => {
    const service = createLineageService(repo as MentorshipRepository);
    const graph = await service.getFullGraph();
    expect(graph.nodes).toHaveLength(4);
  });
});

describe('invalidateLineageCache', () => {
  it('deletes the full graph key and the given handle subgraphs', async () => {
    const redis = memoryRedis();
    redis.dump().set(lineageFullGraphKey(), '{}');
    redis.dump().set(lineageSubgraphKey('ada'), '{}');
    redis.dump().set(lineageSubgraphKey('user_abcd'), '{}');

    await invalidateLineageCache(redis as never, ['ada', 'user_abcd']);

    expect(redis.dump().size).toBe(0);
  });

  it('deletes only the full key when no handles are given', async () => {
    const redis = memoryRedis();
    redis.dump().set(lineageFullGraphKey(), '{}');
    redis.dump().set(lineageSubgraphKey('ada'), '{}');

    await invalidateLineageCache(redis as never);

    expect(redis.dump().has(lineageFullGraphKey())).toBe(false);
    expect(redis.dump().has(lineageSubgraphKey('ada'))).toBe(true);
  });
});
