import type { RichCard, RichCardType } from '@mathitis/schemas';

export const CARD_TYPE_LABELS: Record<RichCardType, string> = {
  song: '♪ MÚSICA',
  game: '▣ JOGOS',
  film: '▶ FILMES',
  book: '📖 LIVROS',
  project: '⚙ PROJETOS',
  custom: '✦ LINKS',
};

export function groupCardsByType(cards: RichCard[]): Record<string, RichCard[]> {
  return cards.reduce(
    (acc, card) => {
      const group = acc[card.cardType] ?? [];
      group.push(card);
      acc[card.cardType] = group;
      return acc;
    },
    {} as Record<string, RichCard[]>,
  );
}
