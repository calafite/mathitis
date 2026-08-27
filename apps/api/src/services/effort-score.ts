/**
 * Calculates the profile effort/complexity score used by the algorithmic matching
 * engine. Derived from biography length, markdown complexity, and rich card count.
 *
 * Scoring budget (max 100):
 * - Biography word count: up to 30 points (300+ words)
 * - Markdown structure complexity: up to 30 points (headers, colours, callouts, code)
 * - Rich cards: up to 40 points (8+ cards)
 * @param biographyMarkdown - The profile's raw markdown biography (may be empty/null)
 * @param richCardCount - Number of rich cards on the profile
 * @returns Normalised score 0-100
 */
export function calculateEffortScore(
  biographyMarkdown: string | null | undefined,
  richCardCount: number,
): number {
  const bio = biographyMarkdown ?? '';
  const wordCount = bio.split(/\s+/).filter(Boolean).length;
  const wordPoints = Math.min(Math.floor(wordCount / 10), 30);

  let complexityPoints = 0;
  const complexityRules: Array<[RegExp, number]> = [
    [/^\s{0,3}#{1,6}\s/m, 4],
    [/\[[^\]]*\]\{[^}]*color=[^}]*\}/m, 4],
    [/```/, 5],
    [/^>\s*\[!/m, 5],
    [/^\s*[-*+]\s+/m, 3],
    [/^\s*\d+\.\s+/m, 3],
    [/\*\*[^*]+\*\*/g, 2],
    [/\[[^\]]*\]\([^)]*\)/g, 2],
  ];
  for (const [pattern, points] of complexityRules) {
    if (pattern.test(bio)) complexityPoints += points;
  }
  const cappedComplexity = Math.min(complexityPoints, 30);

  const cardPoints = Math.min(richCardCount * 5, 40);

  return Math.min(wordPoints + cappedComplexity + cardPoints, 100);
}
