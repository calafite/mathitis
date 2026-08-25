import type { Profile } from '@mathitis/schemas';
import type { ProfileWithRelations } from '../repositories/profile-repository.js';

/**
 * Maps a repository profile (with relations) to the shared `profileSchema`
 * shape so API responses stay consistent across endpoints.
 */
export function toProfileSchema(profile: ProfileWithRelations): Profile {
  return {
    userId: profile.userId,
    handle: profile.user.handle,
    role: profile.user.role,
    semester: profile.user.semester,
    socialName: profile.socialName,
    pronouns: profile.pronouns,
    tagline: profile.tagline,
    biographyMarkdown: profile.biographyMarkdown,
    avatarUrl: profile.avatarUrl,
    bannerUrl: profile.bannerUrl,
    bannerPreset: profile.bannerPreset,
    themePalette: profile.themePalette as Profile['themePalette'],
    socialLinks: profile.socialLinks as Profile['socialLinks'],
    contactEmail: profile.contactEmail,
    maxMentees: profile.maxMentees,
    isDiscoverable: profile.isDiscoverable,
    isAcceptingRequests: profile.isAcceptingRequests,
    profileViews: profile.profileViews,
    effortScore: profile.effortScore,
    tags: profile.tags.map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      category: tag.category,
      color: tag.color,
      icon: tag.icon,
    })),
    richCards: profile.richCards.map((card) => ({
      id: card.id,
      cardType: card.cardType as Profile['richCards'][number]['cardType'],
      title: card.title,
      subtitle: card.subtitle,
      description: card.description,
      imageUrl: card.imageUrl,
      externalUrl: card.externalUrl,
      embedUrl: card.embedUrl,
      accentColor: card.accentColor,
      metadata: card.metadata as Record<string, unknown> | null,
      displayOrder: card.displayOrder,
      createdAt: card.createdAt,
    })),
  };
}