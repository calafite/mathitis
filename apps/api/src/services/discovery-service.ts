import type { RichCardType, SocialLinks, Tag, ThemePalette } from '@mathitis/schemas';
import type { DiscoveryRepository, SeniorRow } from '../repositories/discovery-repository.js';
import type { ProfileRepository } from '../repositories/profile-repository.js';
import type { BumpRepository } from '../repositories/bump-repository.js';
import type { MentorshipRepository } from '../repositories/mentorship-repository.js';
import { calculateMatchScore } from './matching-score.js';

export interface SeniorFilters {
  semester?: number;
  tagIds?: string[];
  cardTypes?: string[];
  availability?: 'accepting' | 'full';
  limit: number;
  offset: number;
}

export interface SeniorSummaryResult {
  userId: string;
  handle: string;
  socialName: string | null;
  tagline: string | null;
  avatarUrl: string | null;
  avatarThumbnailUrl: string | null;
  bannerUrl: string | null;
  bannerPreset: string | null;
  themePalette: ThemePalette | null;
  socialLinks: SocialLinks | null;
  semester: number;
  tags: Tag[];
  contactEmail: string | null;
  richCardTypes: RichCardType[];
  effortScore: number;
  profileViews: number;
  bumpCount: number;
  isAcceptingRequests: boolean;
  maxMentees: number;
  activeMenteeCount: number;
}

export interface DiscoveryService {
  listSeniors(filters: SeniorFilters): Promise<{ seniors: SeniorSummaryResult[]; total: number }>;
  recommend(
    freshmanUserId: string,
    filters: Omit<SeniorFilters, 'offset'>,
  ): Promise<Array<SeniorSummaryResult & { score: number }>>;
  listTags(): Promise<Tag[]>;
}

async function mergeCounts(
  rows: SeniorRow[],
  bumpRepository: BumpRepository,
  mentorshipRepository: MentorshipRepository,
): Promise<SeniorSummaryResult[]> {
  if (rows.length === 0) return [];

  const seniorIds = rows.map((row) => row.userId);

  const [bumpCounts, menteeCounts] = await Promise.all([
    Promise.all(seniorIds.map((id) => bumpRepository.countBySenior(id))),
    Promise.all(seniorIds.map((id) => mentorshipRepository.countActiveBySenior(id))),
  ]);

  return rows.map((row, index) => ({
    userId: row.userId,
    handle: row.handle,
    socialName: row.socialName,
    tagline: row.tagline,
    avatarUrl: row.avatarUrl,
    avatarThumbnailUrl: row.avatarThumbnailUrl,
    bannerUrl: row.bannerUrl,
    bannerPreset: row.bannerPreset,
    themePalette: (row.themePalette ?? null) as ThemePalette | null,
    socialLinks: (row.socialLinks ?? null) as SocialLinks | null,
    semester: row.semester,
    tags: row.tags as Tag[],
    contactEmail: row.contactEmail,
    richCardTypes: row.richCardTypes as RichCardType[],
    effortScore: row.effortScore,
    profileViews: row.profileViews,
    bumpCount: bumpCounts[index] ?? 0,
    isAcceptingRequests: row.isAcceptingRequests,
    maxMentees: row.maxMentees,
    activeMenteeCount: menteeCounts[index] ?? 0,
  }));
}

export function createDiscoveryService(
  discoveryRepository: DiscoveryRepository,
  profileRepository: ProfileRepository,
  bumpRepository: BumpRepository,
  mentorshipRepository: MentorshipRepository,
): DiscoveryService {
  async function listSeniors(filters: SeniorFilters) {
    const [rows, total] = await Promise.all([
      discoveryRepository.listDiscoverableSeniors(filters),
      discoveryRepository.countDiscoverableSeniors(filters),
    ]);
    const seniors = await mergeCounts(rows, bumpRepository, mentorshipRepository);
    return { seniors, total };
  }

  async function recommend(freshmanUserId: string, filters: Omit<SeniorFilters, 'offset'>) {
    const freshmanProfile = await profileRepository.findByUserId(freshmanUserId);
    const freshmanTagIds = freshmanProfile?.tags.map(({ tag }) => tag.id) ?? [];

    const rows = await discoveryRepository.listDiscoverableSeniors({ ...filters, offset: 0 });
    const seniors = await mergeCounts(rows, bumpRepository, mentorshipRepository);

    return seniors
      .map((senior) => ({
        ...senior,
        score: calculateMatchScore({
          freshmanTagIds,
          seniorTagIds: senior.tags.map((tag) => tag.id),
          effortScore: senior.effortScore,
          profileViews: senior.profileViews,
          bumpCount: senior.bumpCount,
        }),
      }))
      .sort((a, b) => b.score - a.score);
  }

  async function listTags() {
    return discoveryRepository.listTags();
  }

  return { listSeniors, recommend, listTags };
}