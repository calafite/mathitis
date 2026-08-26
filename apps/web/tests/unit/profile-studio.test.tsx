import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProfileStudioPage } from '@/pages/profile-studio';
import { profileApi } from '@/lib/profile-api';
import { discoveryApi } from '@/lib/discovery-api';

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    user: { handle: 'ada_math', role: 'senior', semester: 8 },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock('@/lib/profile-api', () => ({
  profileApi: {
    getMe: vi.fn(),
    updateMe: vi.fn(),
    uploadAvatar: vi.fn(),
    uploadBanner: vi.fn(),
  },
}));

vi.mock('@/lib/discovery-api', () => ({
  discoveryApi: {
    listTags: vi.fn(),
    suggestTags: vi.fn(),
    bump: vi.fn(),
    removeBump: vi.fn(),
  },
}));

const mockedProfileApi = vi.mocked(profileApi);
const mockedDiscoveryApi = vi.mocked(discoveryApi);

const allTags = {
  tags: [
    { id: 'tag-algebra', name: 'algebra', category: 'course', color: '#6366f1', icon: '🧮' },
    { id: 'tag-python', name: 'python', category: 'tech-stack', color: '#3b82f6', icon: '🐍' },
    { id: 'tag-ml', name: 'machine-learning', category: 'interest', color: '#ec4899', icon: '🧠' },
  ],
};

const profile = {
  userId: 'user-1',
  handle: 'ada_math',
  role: 'senior' as const,
  semester: 8,
  socialName: 'Ada',
  pronouns: null,
  tagline: null,
  biographyMarkdown: null,
  avatarUrl: null,
  bannerUrl: null,
  bannerPreset: null,
  themePalette: null,
  socialLinks: null,
  contactEmail: null,
  maxMentees: 3,
  isAcceptingRequests: true,
  isDiscoverable: true,
  profileViews: 0,
  effortScore: 5,
  tags: [{ id: 'tag-algebra', name: 'algebra', category: 'course', color: '#6366f1', icon: '🧮' }],
  richCards: [],
};

function renderStudio() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ProfileStudioPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ProfileStudioPage tag selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedProfileApi.getMe.mockResolvedValue({ profile } as never);
    mockedProfileApi.updateMe.mockResolvedValue({ profile } as never);
    mockedDiscoveryApi.listTags.mockResolvedValue(allTags as never);
    mockedDiscoveryApi.suggestTags.mockResolvedValue(allTags as never);
  });

  it('renders the tag section heading and shows preselected tag badges', async () => {
    renderStudio();

    expect(await screen.findByText('Interesses & Especializações')).toBeInTheDocument();

    // The pre-selected algebra tag appears as a badge in the DynamicTagInput
    const algebraBadges = await screen.findAllByText(/algebra/);
    expect(algebraBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('allows typing in the input and shows the create option for unknown tags', async () => {
    const user = userEvent.setup();
    renderStudio();

    await screen.findByText('Interesses & Especializações');

    const input = screen.getByPlaceholderText(/Digite para buscar/);
    await user.type(input, 'Compiladores');

    // Should show "Criar" option since it's not in the catalog
    await waitFor(() => {
      expect(screen.getByText(/Criar/)).toBeInTheDocument();
    });
  });
});
