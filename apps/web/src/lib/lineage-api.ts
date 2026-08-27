import { apiFetch } from '@/lib/api';
import type { LineageResponse } from '@mathitis/schemas';

export const lineageApi = {
  async all(): Promise<LineageResponse> {
    return apiFetch<LineageResponse>('/lineage');
  },

  async forHandle(handle: string): Promise<LineageResponse> {
    return apiFetch<LineageResponse>(`/lineage/${encodeURIComponent(handle)}`);
  },
};
