import { nanoid } from 'nanoid';
import type { UpdateProfileBody, UploadImageResponse, UserRole } from '@mathitis/schemas';
import type { ProfileRepository, ProfileWithRelations } from '../repositories/profile-repository.js';
import type { RichCardRepository } from '../repositories/rich-card-repository.js';
import type { ObjectStorage } from '../storage/storage-service.js';
import { NotFoundError } from '../errors.js';
import { processImage, type ImageKind } from './image-service.js';
import { calculateEffortScore } from './effort-score.js';

export interface Viewer {
  sub: string;
  role: UserRole;
}

export interface ProfileServiceDeps {
  profileRepository: ProfileRepository;
  richCardRepository: RichCardRepository;
  storage: ObjectStorage;
}

export interface ProfileService {
  getProfileByHandle(handle: string, viewer?: Viewer | null): Promise<ProfileWithRelations>;
  getOwnProfile(userId: string): Promise<ProfileWithRelations>;
  updateProfile(userId: string, input: UpdateProfileBody): Promise<ProfileWithRelations>;
  incrementViews(userId: string): Promise<void>;
  recordUniqueView(userId: string, viewerIdentifier: string): Promise<boolean>;
  uploadImage(userId: string, kind: ImageKind, buffer: Buffer): Promise<UploadImageResponse>;
}

export function createProfileService(
  deps: ProfileServiceDeps & {
    /** When provided, view increments are buffered in Redis (flushed by a worker). */
    redis?: {
      hincrby(key: string, field: string, increment: number): Promise<number>;
      pfadd(key: string, member: string): Promise<number>;
    };
  },
): ProfileService {
  const { profileRepository, storage, redis } = deps;

  async function recomputeEffortScore(userId: string) {
    const profile = await profileRepository.findByUserId(userId);
    if (!profile) return;
    const score = calculateEffortScore(profile.biographyMarkdown, profile.richCards.length);
    await profileRepository.setEffortScore(userId, score);
  }

  async function getProfileByHandle(handle: string, viewer?: Viewer | null) {
    const profile = await profileRepository.findByHandle(handle);
    if (!profile) {
      throw new NotFoundError('Perfil não encontrado', 'PROFILE_NOT_FOUND');
    }

    // Freshman privacy: hidden profiles are only visible to their owner and admins.
    // (When requests land in phase 3, the targeted senior gains access too.)
    if (profile.user.role === 'freshman' && !profile.isDiscoverable) {
      const isOwner = viewer?.sub === profile.userId;
      const isAdmin = viewer?.role === 'administrator';
      if (!isOwner && !isAdmin) {
        throw new NotFoundError('Perfil não encontrado', 'PROFILE_NOT_FOUND');
      }
    }

    return profile;
  }

  async function getOwnProfile(userId: string) {
    const profile = await profileRepository.findByUserId(userId);
    if (!profile) {
      throw new NotFoundError('Perfil não encontrado', 'PROFILE_NOT_FOUND');
    }
    return profile;
  }

  async function updateProfile(userId: string, input: UpdateProfileBody) {
    const { tagIds, tagNames, ...profileFields } = input;
    await profileRepository.update(userId, profileFields);
    if (tagIds !== undefined || tagNames !== undefined) {
      await profileRepository.setTags(userId, tagIds ?? [], tagNames);
    }
    await recomputeEffortScore(userId);
    const updated = await profileRepository.findByUserId(userId);
    if (!updated) {
      throw new NotFoundError('Perfil não encontrado', 'PROFILE_NOT_FOUND');
    }
    return updated;
  }

  async function incrementViews(userId: string) {
    if (redis) {
      // Buffer in Redis; a background worker flushes aggregated increments to
      // PostgreSQL every few minutes (keeps reads lock-free in matching season).
      await redis.hincrby('profile:views', userId, 1);
      return;
    }
    await profileRepository.incrementViews(userId);
  }

  async function recordUniqueView(userId: string, viewerIdentifier: string): Promise<boolean> {
    if (!redis) {
      // Without Redis, we can't track unique views; always increment
      await incrementViews(userId);
      return true;
    }
    // Use HyperLogLog to track unique viewers
    const isNewViewer = await redis.pfadd(`profile:unique_views:${userId}`, viewerIdentifier);
    if (isNewViewer === 1) {
      await incrementViews(userId);
      return true;
    }
    return false;
  }

  async function uploadImage(userId: string, kind: ImageKind, buffer: Buffer) {
    const processed = await processImage(buffer, kind);
    const suffix = nanoid(8);
    const folder = kind === 'avatar' ? 'avatars' : 'banners';
    const fullKey = `${folder}/${userId}/${suffix}.webp`;
    const thumbKey = `${folder}/${userId}/${suffix}-thumb.webp`;

    const [full, thumbnail] = await Promise.all([
      storage.putObject(fullKey, processed.variants.full.buffer, 'image/webp'),
      storage.putObject(thumbKey, processed.variants.thumbnail.buffer, 'image/webp'),
    ]);

    if (kind === 'avatar') {
      await profileRepository.setAvatar(userId, full.url, thumbnail.url);
    } else {
      await profileRepository.setBanner(userId, full.url, thumbnail.url);
    }

    return {
      url: full.url,
      thumbnailUrl: thumbnail.url,
      width: processed.variants.full.width,
      height: processed.variants.full.height,
    };
  }

  return {
    getProfileByHandle,
    getOwnProfile,
    updateProfile,
    incrementViews,
    recordUniqueView,
    uploadImage,
  };
}