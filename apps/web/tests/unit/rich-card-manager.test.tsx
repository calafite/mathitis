import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RichCardManager } from '@/components/profile/rich-card-manager';
import { profileApi } from '@/lib/profile-api';
import { ApiError } from '@/lib/api';

vi.mock('@/lib/profile-api', () => ({
  profileApi: {
    listCards: vi.fn(),
    createCard: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
    reorderCards: vi.fn(),
    scrapeCard: vi.fn(),
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
    expect(screen.getByText(/1 cartão/)).toBeInTheDocument();
  });

  it('creates a song card from the form', async () => {
    const user = userEvent.setup();
    mockedApi.createCard.mockResolvedValue({ card: songCard } as never);
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Adicionar cartão' }));
    await user.type(screen.getByPlaceholderText('Título do cartão'), 'Panis et Circenses');
    await user.type(screen.getByPlaceholderText('Mutantes'), 'Mutantes');
    await user.click(screen.getByRole('button', { name: 'Salvar cartão' }));

    await waitFor(() => {
      expect(mockedApi.createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          cardType: 'song',
          title: 'Panis et Circenses',
          metadata: { artistName: 'Mutantes' },
        }),
      );
    });
  });

  it('converts project tech stack CSV into an array and trims empties', async () => {
    const user = userEvent.setup();
    mockedApi.createCard.mockResolvedValue({ card: songCard } as never);
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Adicionar cartão' }));
    await user.selectOptions(screen.getByRole('combobox'), 'project');
    await user.type(screen.getByPlaceholderText('Título do cartão'), 'Math Thesis');
    await user.type(screen.getByPlaceholderText('Python, NumPy, LaTeX'), 'Python,  , LaTeX');

    await user.click(screen.getByRole('button', { name: 'Salvar cartão' }));

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

    await user.click(await screen.findByRole('button', { name: 'Adicionar cartão' }));
    expect(screen.getByRole('button', { name: 'Salvar cartão' })).toBeDisabled();
  });

  it('does not include blank metadata values in the payload', async () => {
    const user = userEvent.setup();
    mockedApi.createCard.mockResolvedValue({ card: songCard } as never);
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Adicionar cartão' }));
    await user.type(screen.getByPlaceholderText('Título do cartão'), 'No Artist');
    await user.click(screen.getByRole('button', { name: 'Salvar cartão' }));

    await waitFor(() => {
      expect(mockedApi.createCard).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
    });
  });

  it('creates a film card with decimal rating and release year as strings', async () => {
    const user = userEvent.setup();
    mockedApi.createCard.mockResolvedValue({ card: songCard } as never);
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Adicionar cartão' }));
    await user.selectOptions(screen.getByRole('combobox'), 'film');
    await user.type(screen.getByPlaceholderText('Título do cartão'), 'Barry Lyndon');
    await user.type(screen.getByPlaceholderText('8.5'), '8.1');
    await user.type(screen.getByPlaceholderText('2024'), '1975');

    await user.click(screen.getByRole('button', { name: 'Salvar cartão' }));

    await waitFor(() => {
      expect(mockedApi.createCard).toHaveBeenCalledWith(
        expect.objectContaining({
          cardType: 'film',
          title: 'Barry Lyndon',
          metadata: { rating: '8.1', year: '1975' },
        }),
      );
    });
  });

  it('autocompletes the form from a scraped link', async () => {
    const user = userEvent.setup();
    mockedApi.scrapeCard.mockResolvedValue({
      cardType: 'song',
      title: 'Ainda Luz',
      subtitle: 'Terno Rei',
      description: null,
      imageUrl: null,
      externalUrl: 'https://open.spotify.com/track/xyz',
      embedUrl: 'https://open.spotify.com/embed/track/xyz',
      accentColor: '#1db954',
      metadata: { spotifyUri: 'spotify:track:xyz' },
    } as never);
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Adicionar cartão' }));
    await user.type(
      screen.getByPlaceholderText('Cole um link do Spotify, Steam, GitHub, Letterboxd ou Livro...'),
      'https://open.spotify.com/track/xyz',
    );
    await user.click(screen.getByRole('button', { name: 'Autocompletar' }));

    expect(mockedApi.scrapeCard.mock.calls[0]?.[0]).toBe('https://open.spotify.com/track/xyz');
    expect(await screen.findByText('✓ Spotify detectado')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ainda Luz')).toBeInTheDocument();
    expect(screen.getByDisplayValue('#1db954')).toBeInTheDocument();
  });

  it('shows an error banner when the scrape request fails', async () => {
    const user = userEvent.setup();
    mockedApi.scrapeCard.mockRejectedValue(
      new ApiError(422, 'NSFW_CONTENT_REJECTED', 'O link fornecido contém conteúdo adulto'),
    );
    renderManager();

    await user.click(await screen.findByRole('button', { name: 'Adicionar cartão' }));
    await user.type(
      screen.getByPlaceholderText('Cole um link do Spotify, Steam, GitHub, Letterboxd ou Livro...'),
      'https://example.com/bad',
    );
    await user.click(screen.getByRole('button', { name: 'Autocompletar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'O link fornecido contém conteúdo adulto',
    );
    expect(screen.queryByText('✓ Spotify detectado')).not.toBeInTheDocument();
  });
});
