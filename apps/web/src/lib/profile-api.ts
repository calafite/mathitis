import { apiFetch } from './api';
import type {
  CreateRichCardBody,
  ProfileResponse,
  ReorderRichCardsBody,
  RichCardResponse,
  RichCardsResponse,
  ScrapedCardResponse,
  UpdateProfileBody,
  UpdateRichCardBody,
  UploadImageResponse,
} from '@mathitis/schemas';

export const profileApi = {
  getByHandle(handle: string) {
    return apiFetch<ProfileResponse>(`/profiles/${handle}`);
  },

  getMe() {
    return apiFetch<ProfileResponse>('/profiles/me');
  },

  updateMe(input: UpdateProfileBody) {
    return apiFetch<ProfileResponse>('/profiles/me', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  uploadAvatar(file: File) {
    return uploadFile('/profiles/me/avatar', file);
  },

  uploadBanner(file: File) {
    return uploadFile('/profiles/me/banner', file);
  },

  listCards() {
    return apiFetch<RichCardsResponse>('/profiles/me/cards');
  },

  createCard(input: CreateRichCardBody) {
    return apiFetch<RichCardResponse>('/profiles/me/cards', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateCard(id: string, input: UpdateRichCardBody) {
    return apiFetch<RichCardResponse>(`/profiles/me/cards/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  deleteCard(id: string) {
    return apiFetch<void>(`/profiles/me/cards/${id}`, { method: 'DELETE' });
  },

  reorderCards(order: string[]) {
    return apiFetch<RichCardsResponse>('/profiles/me/cards/reorder', {
      method: 'PUT',
      body: JSON.stringify({ order } satisfies ReorderRichCardsBody),
    });
  },

  scrapeCard(url: string) {
    return apiFetch<ScrapedCardResponse>(
      `/profiles/me/cards/scrape?url=${encodeURIComponent(url)}`,
    );
  },
};

function uploadFile(path: string, file: File) {
  const form = new FormData();
  form.append('file', file);
  return apiFetch<UploadImageResponse>(path, { method: 'POST', body: form });
}
