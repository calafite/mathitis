import { apiFetch } from '@/lib/api';
import type { BumpResponse, RecommendationsResponse, SeniorsResponse, TagsResponse } from '@mathitis/schemas';

export interface DiscoveryFilters {
  semester?: number;
  tagIds?: string[];
  cardTypes?: string[];
  availability?: 'accepting' | 'full';
  limit?: number;
  offset?: number;
}

function toQueryString(filters: DiscoveryFilters): string {
  const params = new URLSearchParams();
  if (filters.semester !== undefined) params.set('semester', String(filters.semester));
  if (filters.tagIds && filters.tagIds.length > 0) params.set('tagIds', filters.tagIds.join(','));
  if (filters.cardTypes && filters.cardTypes.length > 0)
    params.set('cardTypes', filters.cardTypes.join(','));
  if (filters.availability) params.set('availability', filters.availability);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters.offset !== undefined) params.set('offset', String(filters.offset));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const discoveryApi = {
  async listSeniors(filters: DiscoveryFilters): Promise<SeniorsResponse> {
    return apiFetch<SeniorsResponse>(`/seniors${toQueryString(filters)}`);
  },

  async recommendations(limit?: number): Promise<RecommendationsResponse> {
    const qs = limit !== undefined ? `?limit=${limit}` : '';
    return apiFetch<RecommendationsResponse>(`/recommendations${qs}`);
  },

  async listTags(activeOnly = false): Promise<TagsResponse> {
    const suffix = activeOnly ? '?activeOnly=true' : '';
    return apiFetch<TagsResponse>(`/tags${suffix}`);
  },

  async suggestTags(q: string): Promise<TagsResponse> {
    const params = new URLSearchParams({ q });
    return apiFetch<TagsResponse>(`/tags/suggest?${params}`);
  },

  async bump(handle: string, replaceHandle?: string): Promise<BumpResponse> {
    return apiFetch<BumpResponse>(`/profiles/${encodeURIComponent(handle)}/bump`, {
      method: 'POST',
      body: JSON.stringify(replaceHandle ? { replaceHandle } : {}),
    });
  },

  async removeBump(handle: string): Promise<BumpResponse> {
    return apiFetch<BumpResponse>(`/profiles/${encodeURIComponent(handle)}/bump`, {
      method: 'DELETE',
    });
  },
};