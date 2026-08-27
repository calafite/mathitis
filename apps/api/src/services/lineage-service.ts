import type { LineageNode, LineageResponse } from '@mathitis/schemas';
import type { MentorshipRepository } from '../repositories/mentorship-repository.js';
import {
  LINEAGE_CACHE_TTL_SECONDS,
  lineageFullGraphKey,
  lineageSubgraphKey,
} from '../lib/lineage-cache.js';

export interface LineageService {
  getFullGraph(): Promise<LineageResponse>;
  getSubgraph(handle: string): Promise<LineageResponse>;
}

/** Minimal Redis surface so unit tests can use an in-memory fake. */
export interface LineageCacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
}

/**
 * Builds an undirected ego-graph by expanding mentorships reachable from the
 * requested handle, preserving academic-year edges for the timeline grouping.
 * Results are cached in Redis (cache-aside, 24h TTL) and invalidated by
 * `invalidateLineageCache` on graph-mutating events.
 */
export function createLineageService(
  mentorshipRepository: MentorshipRepository,
  cache?: LineageCacheStore,
): LineageService {
  async function readCache(key: string): Promise<LineageResponse | null> {
    if (!cache) return null;
    try {
      const raw = await cache.get(key);
      return raw ? (JSON.parse(raw) as LineageResponse) : null;
    } catch {
      return null; // Cache failures must never break the graph response.
    }
  }

  async function writeCache(key: string, value: LineageResponse): Promise<void> {
    if (!cache) return;
    try {
      await cache.set(key, JSON.stringify(value), 'EX', LINEAGE_CACHE_TTL_SECONDS);
    } catch {
      // Ignore cache write failures.
    }
  }

  function buildGraph(
    rows: Awaited<ReturnType<MentorshipRepository['listLineage']>>,
  ): LineageResponse {
    const nodeMap = new Map<string, LineageNode>();
    const edges: LineageResponse['edges'] = [];
    const academicYears = new Set<string>();

    for (const row of rows) {
      academicYears.add(row.academicYear);
      addNode(
        nodeMap,
        row.mentorId,
        row.mentor.handle,
        row.mentor.socialName,
        row.mentor.semester,
        row.mentor.role,
      );
      addNode(
        nodeMap,
        row.menteeId,
        row.mentee.handle,
        row.mentee.socialName,
        row.mentee.semester,
        row.mentee.role,
      );
      edges.push({
        mentorId: row.mentorId,
        menteeId: row.menteeId,
        academicYear: row.academicYear,
        semester: row.semester,
      });
    }

    return {
      nodes: [...nodeMap.values()],
      edges,
      academicYears: [...academicYears].sort(),
    };
  }

  async function getFullGraph(): Promise<LineageResponse> {
    const key = lineageFullGraphKey();
    const cached = await readCache(key);
    if (cached) return cached;
    const graph = buildGraph(await mentorshipRepository.listLineage());
    await writeCache(key, graph);
    return graph;
  }

  async function getSubgraph(handle: string): Promise<LineageResponse> {
    const key = lineageSubgraphKey(handle);
    const cached = await readCache(key);
    if (cached) return cached;
    const rows = await mentorshipRepository.listLineage();
    const relevant = rows.filter(
      (row) => row.mentor.handle === handle || row.mentee.handle === handle,
    );
    const graph = buildGraph(relevant);
    await writeCache(key, graph);
    return graph;
  }

  return { getFullGraph, getSubgraph };
}

function addNode(
  nodeMap: Map<string, LineageNode>,
  id: string,
  handle: string,
  socialName: string | null,
  semester: number,
  role: string,
) {
  if (nodeMap.has(id)) return;
  nodeMap.set(id, {
    id,
    handle,
    socialName,
    semester,
    role: role as LineageNode['role'],
  });
}
