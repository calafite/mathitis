import { buildMatchReasons, calculateMatchScore } from './matching-score.js';

/** The minimal tag shape the engine needs; `Tag` is assignable to it. */
export interface RankableTag {
  id: string;
  name: string;
  embedding?: number[] | null;
}

/**
 * A senior that can be ranked. Structural subset of `SeniorSummaryResult`,
 * defined here so the engine has no dependency on the discovery service.
 */
export interface RankableSenior {
  userId: string;
  tags: RankableTag[];
  effortScore: number;
  profileViews: number;
  bumpCount: number;
  isAcceptingRequests: boolean;
}

export type ScoredSenior<T extends RankableSenior = RankableSenior> = T & {
  score: number;
  matchReasons: string[];
};

export interface RecommendationEngine {
  /**
   * Ranks a list of discoverable seniors for a freshman, returning each
   * senior with its compatibility score and explainable match reasons,
   * ordered by descending score.
   */
  rank<T extends RankableSenior>(
    freshmanTags: RankableTag[],
    seniors: T[],
  ): Array<ScoredSenior<T>>;
}

function buildEmbeddingMap(tags: RankableTag[]): Map<string, number[]> {
  const map = new Map<string, number[]>();
  for (const tag of tags) {
    if (tag.embedding && tag.embedding.length > 0) {
      map.set(tag.id, tag.embedding);
    }
  }
  return map;
}

/**
 * The algorithmic matching engine: computes the weighted compatibility score
 * (see architecture §8.5) and the human-readable reasons behind it.
 */
export function createRecommendationEngine(): RecommendationEngine {
  function rank<T extends RankableSenior>(
    freshmanTags: RankableTag[],
    seniors: T[],
  ): Array<ScoredSenior<T>> {
    const freshmanEmbeddings = buildEmbeddingMap(freshmanTags);

    return seniors
      .map((senior) => {
        const seniorEmbeddings = buildEmbeddingMap(senior.tags);

        const score = calculateMatchScore({
          freshmanTagIds: freshmanTags.map((tag) => tag.id),
          seniorTagIds: senior.tags.map((tag) => tag.id),
          effortScore: senior.effortScore,
          profileViews: senior.profileViews,
          bumpCount: senior.bumpCount,
          freshmanEmbeddings,
          seniorEmbeddings,
        });
        const matchReasons = buildMatchReasons({
          freshmanTags,
          seniorTags: senior.tags,
          effortScore: senior.effortScore,
          profileViews: senior.profileViews,
          bumpCount: senior.bumpCount,
          isAcceptingRequests: senior.isAcceptingRequests,
          freshmanEmbeddings,
          seniorEmbeddings,
        });
        return { ...senior, score, matchReasons };
      })
      .sort((a, b) => b.score - a.score);
  }

  return { rank };
}
