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
}

export const WEIGHTS = {
  tagOverlap: 0.4,
  effort: 0.3,
  views: 0.1,
  bumps: 0.2,
} as const;

/**
 * Pure weighted compatibility score used by the recommendation engine.
 *
 *   Match = 0.40*TagOverlap + 0.30*Effort + 0.10*Views + 0.20*Bumps
 *
 * - Tag overlap is the Jaccard index between the freshman and senior tags (0-100).
 * - Views are log10-normalised so popular profiles saturate slowly.
 * - Bumps are capped at the 4 active-bump limit.
 */
export function calculateMatchScore(input: MatchInput): number {
  const overlap =
    input.freshmanTagIds.length === 0 || input.seniorTagIds.length === 0
      ? 0
      : intersectionSize(input.freshmanTagIds, input.seniorTagIds) /
        Math.max(unionSize(input.freshmanTagIds, input.seniorTagIds), 1);

  const tagOverlap = 100 * overlap;

  const viewsScore = Math.min(100, (Math.log10(input.profileViews + 1) / 3) * 100);

  const bumpsScore = Math.min(100, input.bumpCount * 25);

  const total =
    WEIGHTS.tagOverlap * tagOverlap +
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