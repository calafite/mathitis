import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createProfileService } from '../../src/services/profile-service.js';
import type { ProfileRepository, ProfileWithRelations } from '../../src/repositories/profile-repository.js';
import type { RichCardRepository } from '../../src/repositories/rich-card-repository.js';
import type { ObjectStorage } from '../../src/storage/storage-service.js';
import type { UpdateProfileBody } from '@mathitis/schemas';

function makeProfile(): ProfileWithRelations {
  return {
    userId: 'user-1',
    socialName: 'Ada',
    pronouns: null,
    tagline: null,
    biographyMarkdown: null,
    avatarUrl: null,
    avatarThumbnailUrl: null,
    bannerUrl: null,
    bannerThumbnailUrl: null,
    bannerPreset: null,
    themePalette: null,
    socialLinks: null,
    contactEmail: null,
    maxMentees: 3,
    isDiscoverable: true,
    isAcceptingRequests: true,
    profileViews: 0,
    effortScore: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { handle: 'ada', role: 'senior', semester: 8, deletedAt: null },
    tags: [],
    richCards: [],
  } as unknown as ProfileWithRelations;
}

describe('createProfileService.updateProfile tag sync', () => {
  let repository: {
    findByUserId: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    setTags: ReturnType<typeof vi.fn>;
    setEffortScore: ReturnType<typeof vi.fn>;
  };
  let service: ReturnType<typeof createProfileService>;

  beforeEach(() => {
    repository = {
      findByUserId: vi.fn().mockResolvedValue(makeProfile()),
      update: vi.fn().mockResolvedValue(undefined),
      setTags: vi.fn().mockResolvedValue(undefined),
      setEffortScore: vi.fn().mockResolvedValue(undefined),
    };
    const richCards = {} as RichCardRepository;
    const storage = {} as ObjectStorage;
    service = createProfileService({
      profileRepository: repository as unknown as ProfileRepository,
      richCardRepository: richCards,
      storage,
    });
  });

  it('overwrites the tag set when tagIds are provided', async () => {
    const body: UpdateProfileBody = {
      tagline: 'Grafos e gentileza',
      tagIds: ['tag-a', 'tag-b', 'tag-c'],
    };

    await service.updateProfile('user-1', body);

    expect(repository.update).toHaveBeenCalledWith('user-1', { tagline: 'Grafos e gentileza' });
    expect(repository.setTags).toHaveBeenCalledWith('user-1', ['tag-a', 'tag-b', 'tag-c'], undefined);
  });

  it('clears all tags when an empty array is provided', async () => {
    await service.updateProfile('user-1', { tagIds: [] });
    expect(repository.setTags).toHaveBeenCalledWith('user-1', [], undefined);
  });

  it('does not touch tags when tagIds are omitted', async () => {
    await service.updateProfile('user-1', { tagline: 'Só uma frase' });
    expect(repository.setTags).not.toHaveBeenCalled();
  });
});
