const API_BASE = '/api';

const CSRF_COOKIE = 'mathitis_csrf';
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  for (const part of document.cookie.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      return decodeURIComponent(trimmed.slice(prefix.length));
    }
  }
  return undefined;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const method = (init?.method ?? 'GET').toUpperCase();
  const csrfToken = STATE_CHANGING_METHODS.has(method) ? getCookie(CSRF_COOKIE) : undefined;
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      ...init?.headers,
    },
  });

  const data = (await response.json().catch(() => null)) as
    T | { error?: { code: string; message: string; statusCode: number } } | null;

  if (!response.ok) {
    const error =
      data && typeof data === 'object' && 'error' in data
        ? (data as { error?: { code: string; message: string; statusCode: number } }).error
        : undefined;
    throw new ApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? 'Request failed',
    );
  }

  return data as T;
}
