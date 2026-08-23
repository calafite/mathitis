import type { RichCard } from '@prisma/client';
import type {
  CreateRichCardBody,
  RichCardType,
  UpdateRichCardBody,
} from '@mathitis/schemas';
import type { RichCardRepository } from '../repositories/rich-card-repository.js';
import type { ProfileRepository } from '../repositories/profile-repository.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { calculateEffortScore } from './effort-score.js';
import { enrichCardMetadata, validateCardEmbedUrl } from './rich-card-validation.js';

export interface RichCardService {
  listCards(userId: string): Promise<RichCard[]>;
  createCard(userId: string, input: CreateRichCardBody): Promise<RichCard>;
  updateCard(userId: string, id: string, input: UpdateRichCardBody): Promise<RichCard>;
  deleteCard(userId: string, id: string): Promise<void>;
  reorderCards(userId: string, order: string[]): Promise<RichCard[]>;
}

export function createRichCardService(
  richCardRepository: RichCardRepository,
  profileRepository: ProfileRepository,
): RichCardService {
  async function recomputeEffortScore(userId: string) {
    const profile = await profileRepository.findByUserId(userId);
    if (!profile) return;
    const score = calculateEffortScore(profile.biographyMarkdown, profile.richCards.length);
    await profileRepository.setEffortScore(userId, score);
  }

  async function listCards(userId: string) {
    return richCardRepository.listByProfileId(userId);
  }

  async function createCard(userId: string, input: CreateRichCardBody) {
    validateCardEmbedUrl(input.embedUrl);
    const metadata = enrichCardMetadata(
      input.cardType,
      input.metadata,
      input.embedUrl,
      input.externalUrl,
    );

    const existing = await richCardRepository.listByProfileId(userId);
    const nextOrder = existing.length > 0 ? Math.max(...existing.map((c) => c.displayOrder)) + 1 : 0;

    const card = await richCardRepository.create(userId, {
      cardType: input.cardType,
      title: input.title,
      subtitle: input.subtitle ?? null,
      description: input.description ?? null,
      imageUrl: input.imageUrl ?? null,
      externalUrl: input.externalUrl ?? null,
      embedUrl: input.embedUrl ?? null,
      accentColor: input.accentColor,
      metadata: metadata as object,
      displayOrder: nextOrder,
    });

    await recomputeEffortScore(userId);
    return card;
  }

  async function updateCard(userId: string, id: string, input: UpdateRichCardBody) {
    const existing = await richCardRepository.findOwnedById(id, userId);
    if (!existing) {
      throw new NotFoundError('Rich card not found', 'CARD_NOT_FOUND');
    }

    if (input.embedUrl !== undefined) validateCardEmbedUrl(input.embedUrl);

    const mergedMetadata =
      input.metadata !== undefined
        ? enrichCardMetadata(
            (input.cardType ?? existing.cardType) as RichCardType,
            input.metadata,
            input.embedUrl ?? existing.embedUrl,
            input.externalUrl ?? existing.externalUrl,
          )
        : existing.metadata;

    return richCardRepository.update(id, {
      ...(input.cardType !== undefined ? { cardType: input.cardType } : {}),
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.subtitle !== undefined ? { subtitle: input.subtitle } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
      ...(input.externalUrl !== undefined ? { externalUrl: input.externalUrl } : {}),
      ...(input.embedUrl !== undefined ? { embedUrl: input.embedUrl } : {}),
      ...(input.accentColor !== undefined ? { accentColor: input.accentColor } : {}),
      ...(mergedMetadata !== undefined && mergedMetadata !== null
        ? { metadata: mergedMetadata as object }
        : {}),
    });
  }

  async function deleteCard(userId: string, id: string) {
    const existing = await richCardRepository.findOwnedById(id, userId);
    if (!existing) {
      throw new NotFoundError('Rich card not found', 'CARD_NOT_FOUND');
    }
    await richCardRepository.remove(id);
    await recomputeEffortScore(userId);
  }

  async function reorderCards(userId: string, order: string[]) {
    const existing = await richCardRepository.listByProfileId(userId);
    if (order.length !== existing.length) {
      throw new ValidationError('A ordem deve conter todos os cartões do perfil');
    }
    const ownedIds = new Set(existing.map((card) => card.id));
    if (order.some((id) => !ownedIds.has(id))) {
      throw new ValidationError('A ordem contém um cartão que não pertence a este perfil');
    }
    await richCardRepository.reorder(
      order.map((id, index) => ({ id, displayOrder: index })),
    );
    return richCardRepository.listByProfileId(userId);
  }

  return { listCards, createCard, updateCard, deleteCard, reorderCards };
}