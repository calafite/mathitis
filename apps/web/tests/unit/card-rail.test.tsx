import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardRail, CardRailItem } from '@/components/profile/rich-card-shared';
import type { RichCard } from '@mathitis/schemas';

function makeCard(id: string, overrides: Partial<RichCard> = {}): RichCard {
  return {
    id,
    cardType: 'film',
    title: `Filme ${id}`,
    subtitle: null,
    description: null,
    embedUrl: null,
    externalUrl: null,
    imageUrl: null,
    accentColor: '#00e054',
    metadata: {},
    position: 0,
    ...overrides,
  } as RichCard;
}

describe('CardRail', () => {
  it('renders cards in a horizontal flex row without wrapping', () => {
    render(
      <CardRail>
        {[makeCard('a'), makeCard('b'), makeCard('c')].map((card) => (
          <CardRailItem key={card.id} card={card} />
        ))}
      </CardRail>,
    );

    const rail = screen.getByTestId('card-rail');
    expect(rail).toBeInTheDocument();
    expect(rail.className).toContain('flex');
    expect(rail.className).toContain('overflow-x-auto');
    expect(rail.className).not.toContain('flex-wrap');

    const items = rail.querySelectorAll(':scope > div');
    expect(items).toHaveLength(3);
    items.forEach((item) => {
      expect(item.className).toContain('shrink-0');
      expect(item.className).toContain('w-72');
    });
  });

  it('renders navigation arrows for the rail', () => {
    render(
      <CardRail>
        <CardRailItem card={makeCard('a')} />
      </CardRail>,
    );
    expect(screen.getByRole('button', { name: 'Rolar para a esquerda' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rolar para a direita' })).toBeInTheDocument();
  });
});
