import { dotProduct } from '../lib/embeddings.js';

export interface MatchInput {
  /** The set of tag ids on the freshman's profile. */
  freshmanTagIds: string[];
  /** The set of tag ids on the senior's profile. */
  seniorTagIds: string[];
  /** The senior's profile effort score (0-100). */
  effortScore: number;
  /** Number of profile views on the senior's profile. */
  profileViews: number;
  /** Number of bumps the senior has received. */
  bumpCount: number;
  /** L2-normalized embeddings keyed by tag id (optional for backward compat). */
  freshmanEmbeddings?: Map<string, number[]>;
  seniorEmbeddings?: Map<string, number[]>;
}

export const WEIGHTS = {
  tagOverlap: 0.4,
  effort: 0.3,
  views: 0.1,
  bumps: 0.2,
} as const;

/**
 * Thresholds that decide which human-readable reasons are surfaced for a
 * recommendation. Values are tuned to the score components they describe.
 */
export const REASON_THRESHOLDS = {
  /** effortScore at which a profile is described as "detailed" */
  effortDetailed: 40,
  /** effortScore at which a profile is described as "rich" */
  effortRich: 60,
  /** profileViews at which a profile is described as "popular" */
  viewsPopular: 40,
  /** profileViews at which a profile is described as "in high demand" */
  viewsHighDemand: 120,
  /** bumpCount at which a senior is "recently bumped" */
  bumpsNoticed: 1,
  /** bumpCount at which a senior is "frequently bumped" */
  bumpsFrequent: 2,
  /** dot-product threshold for "similar interests" reason */
  semanticSimilar: 0.75,
} as const;

const SHARED_TAGS_CAP = 3;
const SEMANTIC_PAIRS_CAP = 3;

export interface MatchReasonInput {
  /** Tag entries on the freshman profile (id + name). */
  freshmanTags: Array<{ id: string; name: string }>;
  /** Tag entries on the senior profile (id + name). */
  seniorTags: Array<{ id: string; name: string }>;
  /** The senior's profile effort score (0-100). */
  effortScore: number;
  /** Number of profile views on the senior's profile. */
  profileViews: number;
  /** Number of bumps the senior has received. */
  bumpCount: number;
  /** Whether the senior is currently accepting mentorship requests. */
  isAcceptingRequests?: boolean;
  /** Embeddings keyed by tag id (optional). */
  freshmanEmbeddings?: Map<string, number[]>;
  seniorEmbeddings?: Map<string, number[]>;
}

/**
 * Computes the soft semantic similarity between two sets of tag embeddings.
 * For each freshman tag, finds the most similar senior tag and averages those
 * best-match similarities. Returns a 0-100 score.
 */
export function calculateSemanticTagScore(
  freshmanEmbeddings: Map<string, number[]>,
  seniorEmbeddings: Map<string, number[]>,
): number {
  if (freshmanEmbeddings.size === 0 || seniorEmbeddings.size === 0) return 0;

  const seniorVecs = [...seniorEmbeddings.values()];
  let totalSim = 0;

  for (const fVec of freshmanEmbeddings.values()) {
    let maxSim = 0;
    for (const sVec of seniorVecs) {
      const sim = dotProduct(fVec, sVec);
      if (sim > maxSim) maxSim = sim;
    }
    totalSim += Math.max(0, maxSim);
  }

  return Math.min(100, Math.round((totalSim / freshmanEmbeddings.size) * 100));
}

/**
 * Finds pairs of freshman/senior tags (distinct names) whose embeddings have
 * high cosine similarity (≥ threshold), returning up to SEMANTIC_PAIRS_CAP
 * pairs for the match reasons.
 */
export function findSemanticPairs(
  freshmanTags: Array<{ id: string; name: string }>,
  seniorTags: Array<{ id: string; name: string }>,
  freshmanEmbeddings: Map<string, number[]>,
  seniorEmbeddings: Map<string, number[]>,
  threshold: number = REASON_THRESHOLDS.semanticSimilar,
): Array<{ freshmanTag: string; seniorTag: string }> {
  const pairs: Array<{ freshmanTag: string; seniorTag: string; sim: number }> = [];
  const sharedIds = new Set(
    freshmanTags.filter((t) => seniorTags.some((s) => s.id === t.id)).map((t) => t.id),
  );

  for (const fTag of freshmanTags) {
    const fVec = freshmanEmbeddings.get(fTag.id);
    if (!fVec) continue;
    for (const sTag of seniorTags) {
      if (sharedIds.has(fTag.id) && fTag.id === sTag.id) continue;
      const sVec = seniorEmbeddings.get(sTag.id);
      if (!sVec) continue;
      const sim = dotProduct(fVec, sVec);
      if (sim >= threshold) {
        pairs.push({ freshmanTag: fTag.name, seniorTag: sTag.name, sim });
      }
    }
  }

  return pairs
    .sort((a, b) => b.sim - a.sim)
    .slice(0, SEMANTIC_PAIRS_CAP)
    .map(({ freshmanTag, seniorTag }) => ({ freshmanTag, seniorTag }));
}

/**
 * Builds the human-readable reasons explaining a senior's recommendation,
 * derived from the same signals that drive the score.
 *
 * A reason is only emitted when the contributing signal is meaningful, so a
 * senior with no overlap, a sparse profile, and no traffic yields `[]`.
 */
export function buildMatchReasons(input: MatchReasonInput): string[] {
  const reasons: string[] = [];

  const freshmanTagIds = new Set(input.freshmanTags.map((tag) => tag.id));
  const shared = input.seniorTags.filter((tag) => freshmanTagIds.has(tag.id));
  if (shared.length > 0) {
    const shown = shared.slice(0, SHARED_TAGS_CAP).map((tag) => tag.name);
    const extra = shared.length - shown.length;
    const suffix = extra > 0 ? ` +${extra}` : '';
    reasons.push(
      shared.length === 1
        ? `1 interesse em comum: ${shown[0]}`
        : `${shared.length} interesses em comum: ${shown.join(', ')}${suffix}`,
    );
  }

  // Semantic similarity reasons for distinct tag pairs.
  if (input.freshmanEmbeddings && input.seniorEmbeddings) {
    const semanticPairs = findSemanticPairs(
      input.freshmanTags,
      input.seniorTags,
      input.freshmanEmbeddings,
      input.seniorEmbeddings,
    );
    for (const pair of semanticPairs) {
      reasons.push(`Interesses afins: ${pair.freshmanTag} ~ ${pair.seniorTag}`);
    }
  }

  if (input.effortScore >= REASON_THRESHOLDS.effortRich) {
    reasons.push('Perfil rico e muito detalhado');
  } else if (input.effortScore >= REASON_THRESHOLDS.effortDetailed) {
    reasons.push('Perfil detalhado');
  }

  if (input.profileViews >= REASON_THRESHOLDS.viewsHighDemand) {
    reasons.push('Em alta entre os estudantes');
  } else if (input.profileViews >= REASON_THRESHOLDS.viewsPopular) {
    reasons.push('Perfil popular entre estudantes');
  }

  if (input.bumpCount >= REASON_THRESHOLDS.bumpsFrequent) {
    reasons.push('Frequentemente impulsionado por calouros');
  } else if (input.bumpCount >= REASON_THRESHOLDS.bumpsNoticed) {
    reasons.push('Recentemente impulsionado por um calouro');
  }

  if (input.isAcceptingRequests) {
    reasons.push('Aceitando novos ferinhas');
  }

  return reasons;
}

/**
 * Pure weighted compatibility score used by the recommendation engine.
 *
 *   Match = 0.40*TagScore + 0.30*Effort + 0.10*Views + 0.20*Bumps
 *
 * TagScore = max(JaccardOverlap, SemanticTagScore).
 * When no embeddings are available, falls back to pure Jaccard.
 *
 * - Views are log10-normalised so popular profiles saturate slowly.
 * - Bumps are capped at the 4 active-bump limit.
 */
export function calculateMatchScore(input: MatchInput): number {
  const jaccard =
    input.freshmanTagIds.length === 0 || input.seniorTagIds.length === 0
      ? 0
      : intersectionSize(input.freshmanTagIds, input.seniorTagIds) /
        Math.max(unionSize(input.freshmanTagIds, input.seniorTagIds), 1);

  let tagScore = 100 * jaccard;

  if (input.freshmanEmbeddings && input.seniorEmbeddings) {
    const semantic = calculateSemanticTagScore(input.freshmanEmbeddings, input.seniorEmbeddings);
    tagScore = Math.max(tagScore, semantic);
  }

  const viewsScore = Math.min(100, (Math.log10(input.profileViews + 1) / 3) * 100);

  const bumpsScore = Math.min(100, input.bumpCount * 25);

  const total =
    WEIGHTS.tagOverlap * tagScore +
    WEIGHTS.effort * Math.min(100, Math.max(0, input.effortScore)) +
    WEIGHTS.views * viewsScore +
    WEIGHTS.bumps * bumpsScore;

  return Math.round(total);
}

function intersectionSize(a: string[], b: string[]): number {
  const set = new Set(b);
  return a.reduce((count, item) => (set.has(item) ? count + 1 : count), 0);
}

function unionSize(a: string[], b: string[]): number {
  return new Set([...a, ...b]).size;
}
