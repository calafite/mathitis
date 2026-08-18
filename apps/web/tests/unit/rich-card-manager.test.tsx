import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RichCardManager } from '@/components/profile/rich-card-manager';
import { profileApi } from '@/lib/profile-api';

vi.mock('@/lib/profile-api', () => ({
  profileApi: {
    listCards: vi.fn(),
    createCard: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
    reorderCards: vi.fn(),
  },
}));

const mockedApi = vi.mocked(profileApi);

const songCard = {
  id: 'card-1',
  cardType: 'song' as const,
  title: 'Paranoid Android',
  subtitle: 'OK Computer',
  description: null,
  embedUrl: 'https://open.spotify.com/embed/track/abc',
  externalUrl: null,
  imageUrl: null,
  accentColor: '#6366f1',
  metadata: { artistName: 'Radiohead' },
  position: 0,
};

function renderManager() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RichCardManager />
    </QueryClientProvider>,
  );
}

describe('RichCardManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.listCards.mockResolvedValue({ cards: [songCard] } as never);
  });

  it('lists the user cards with type labels', async () => {
    renderManager();

    expect(await screen.findByText('Paranoid Android')).toBeInTheDocument();
    expect(screen.getByText('song')).toBeInTheDocument();
    expect(screen.getByText(/1 card/)).toBeInTheDocument();
  });

  it('creates a song card from the form', async () => {
    const user = userEvent.setup();
    mockedApi.createCard.mockResolvedValue({ card: songCard } as never);
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Add card' }));
    await user.type(screen.getByPlaceholderText('Card title'), 'Karma Police');
    await user.type(screen.getByPlaceholderText('Radiohead'), 'Radiohead');
    await user.click(screen.getByRole('button', { name: 'Save card' }));

    await waitFor(() => {
      expect(mockedApi.createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          cardType: 'song',
          title: 'Karma Police',
          metadata: { artistName: 'Radiohead' },
        }),
      );
    });
  });

  it('converts project tech stack CSV into an array and trims empties', async () => {
    const user = userEvent.setup();
    mockedApi.createCard.mockResolvedValue({ card: songCard } as never);
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Add card' }));
    await user.selectOptions(screen.getByRole('combobox'), 'project');
    await user.type(screen.getByPlaceholderText('Card title'), 'Math Thesis');
    await user.type(screen.getByPlaceholderText('Python, NumPy, LaTeX'), 'Python,  , LaTeX');

    await user.click(screen.getByRole('button', { name: 'Save card' }));

    await waitFor(() => {
      expect(mockedApi.createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          cardType: 'project',
          title: 'Math Thesis',
          metadata: { techStack: ['Python', 'LaTeX'] },
        }),
      );
    });
  });

  it('disables saving while the title is empty', async () => {
    const user = userEvent.setup();
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Add card' }));
    expect(screen.getByRole('button', { name: 'Save card' })).toBeDisabled();
  });

  it('does not include blank metadata values in the payload', async () => {
    const user = userEvent.setup();
    mockedApi.createCard.mockResolvedValue({ card: songCard } as never);
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Add card' }));
    await user.type(screen.getByPlaceholderText('Card title'), 'No Artist');
    await user.click(screen.getByRole('button', { name: 'Save card' }));

    await waitFor(() => {
      expect(mockedApi.createCard).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
    });
  });
});
