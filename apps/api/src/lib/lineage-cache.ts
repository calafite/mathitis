import type { Redis } from 'ioredis';

const FULL_GRAPH_KEY = 'lineage:full';
const SUBGRAPH_PREFIX = 'lineage:subgraph:';

export const LINEAGE_CACHE_TTL_SECONDS = 86_400; // 24h

/**
 * Cache-aside invalidator for the lineage graph. Deletes the full-graph key
 * and any handle-scoped subgraph keys. Called whenever a graph-mutating
 * event happens (mentorship created, user anonymized).
 */
export async function invalidateLineageCache(redis: Redis, handles?: string[]): Promise<void> {
  const keys = [FULL_GRAPH_KEY];
  for (const handle of handles ?? []) {
    if (handle) keys.push(`${SUBGRAPH_PREFIX}${handle}`);
  }
  await redis.del(...keys);
}

export function lineageFullGraphKey(): string {
  return FULL_GRAPH_KEY;
}

export function lineageSubgraphKey(handle: string): string {
  return `${SUBGRAPH_PREFIX}${handle}`;
}
