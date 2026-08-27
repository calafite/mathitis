import { apiFetch } from './api';
import type { UserDataExport } from '@mathitis/schemas';

export interface OkResponse {
  ok: boolean;
}

export interface AccountSettingsResponse {
  email: string;
  semester: number;
  preferences: {
    theme?: 'dark' | 'light' | 'system';
    reducedMotion?: boolean;
    soundEnabled?: boolean;
    emailNotifications?: boolean;
    onboarded?: boolean;
  } | null;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateAccountInput {
  semester?: number;
  preferences?: {
    theme?: 'dark' | 'light' | 'system';
    reducedMotion?: boolean;
    soundEnabled?: boolean;
    emailNotifications?: boolean;
    onboarded?: boolean;
  };
}

export interface AnonymizeInput {
  password: string;
}

export const settingsApi = {
  get() {
    return apiFetch<AccountSettingsResponse>('/account/settings');
  },

  changePassword(input: ChangePasswordInput) {
    return apiFetch<OkResponse>('/account/change-password', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  updateAccount(input: UpdateAccountInput) {
    return apiFetch<OkResponse>('/account', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },

  exportData() {
    return apiFetch<UserDataExport>('/account/export');
  },

  anonymize(input: AnonymizeInput) {
    return apiFetch<OkResponse>('/account/anonymize', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};