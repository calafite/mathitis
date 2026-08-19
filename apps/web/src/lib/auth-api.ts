import { apiFetch } from './api';
import type { AuthUser } from '@mathitis/schemas';

export interface AuthResponse {
  user: AuthUser;
}

export interface GenericResponse {
  ok: true;
  message: string;
}

export const authApi = {
  register(input: {
    handle: string;
    email: string;
    password: string;
    semester: number;
    socialName?: string;
  }) {
    return apiFetch<GenericResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  login(input: { identifier: string; password: string }) {
    return apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  logout() {
    return apiFetch<GenericResponse>('/auth/logout', {
      method: 'POST',
    });
  },

  me() {
    return apiFetch<AuthResponse>('/auth/me');
  },

  recover(input: { email: string }) {
    return apiFetch<GenericResponse>('/auth/recover', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  verifyEmail(token: string) {
    return apiFetch<GenericResponse>(`/auth/verify-email/${encodeURIComponent(token)}`);
  },

  resetPassword(input: { token: string; password: string }) {
    return apiFetch<GenericResponse>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};
