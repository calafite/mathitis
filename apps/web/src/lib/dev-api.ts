import { apiFetch } from '@/lib/api';
import type { DevHealth, DevMetricsResponse } from '@mathitis/schemas';

export const devApi = {
  async health(): Promise<DevHealth> {
    return apiFetch<DevHealth>('/dev/health');
  },

  async metrics(): Promise<DevMetricsResponse> {
    return apiFetch<DevMetricsResponse>('/dev/metrics');
  },
};