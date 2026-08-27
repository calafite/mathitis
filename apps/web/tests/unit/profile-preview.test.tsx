import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type RichCard, type RichCardType, type ThemePalette } from '@mathitis/schemas';
import { ProfilePreview, type ProfileDraft } from '@/components/profile/profile-preview';

const PALETTE: ThemePalette = {
  primaryColor: '#c9f24c',
  accentColor: '#ff4d14',
  badgeColor: '#c9f24c',
  fontFamily: 'sans',
};

function makeCard(id: string, cardType: RichCardType, title: string): RichCard {
  return {
    id,
    cardType,
    title,
    subtitle: null,
    description: null,
    embedUrl: null,
    externalUrl: null,
    imageUrl: null,
    accentColor: '#000000',
    metadata: {},
    position: 0,
  } as RichCard;
}

function makeDraft(): ProfileDraft {
  return {
    socialName: 'Ada Lovelace',
    pronouns: 'ela/dela',
    tagline: 'Matemática & computação',
    biographyMarkdown: '',
    themePalette: PALETTE,
    contactEmail: '',
    socialLinks: {},
    maxMentees: 3,
    isAcceptingRequests: true,
    isDiscoverable: true,
    tags: [],
  };
}

// The category sub-headers use plural labels (JOGOS / PROJETOS / FILMES),
// which never appear on card badges (those use singular labels). Their
// presence therefore uniquely signals the expanded categorized view.
describe('ProfilePreview expanded showcase grid', () => {
  const cards: RichCard[] = [
    makeCard('s1', 'song', 'Everlong'),
    makeCard('s2', 'song', 'Toxicity'),
    makeCard('g1', 'game', 'Baldur'),
    makeCard('p1', 'project', 'Mathitis'),
  ];

  it('shows the count in the toggle and is collapsed by default', () => {
    render(<ProfilePreview draft={makeDraft()} cards={cards} effortScore={0} />);
    expect(screen.getByRole('button', { name: '[ VER TODOS (4) ]' })).toBeInTheDocument();
    expect(screen.queryByText('▣ JOGOS')).not.toBeInTheDocument();
  });

  it('expands into categorized sub-headers when VER TODOS is clicked', async () => {
    const user = userEvent.setup();
    render(<ProfilePreview draft={makeDraft()} cards={cards} effortScore={0} />);

    await user.click(screen.getByRole('button', { name: '[ VER TODOS (4) ]' }));

    expect(screen.getByText('▣ JOGOS')).toBeInTheDocument();
    expect(screen.getByText('⚙ PROJETOS')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: '[ COLAPSAR ]' })).toBeInTheDocument();
  });

  it('collapses back to the rail when COLAPSAR is clicked', async () => {
    const user = userEvent.setup();
    render(<ProfilePreview draft={makeDraft()} cards={cards} effortScore={0} />);

    await user.click(screen.getByRole('button', { name: '[ VER TODOS (4) ]' }));
    expect(screen.getByText('▣ JOGOS')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '[ COLAPSAR ]' }));
    expect(screen.queryByText('▣ JOGOS')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '[ VER TODOS (4) ]' })).toBeInTheDocument();
  });

  it('does not render the toggle when there are no cards', () => {
    render(<ProfilePreview draft={makeDraft()} cards={[]} effortScore={0} />);
    expect(screen.queryByRole('button', { name: /VER TODOS/i })).not.toBeInTheDocument();
  });
});
