import { config } from '../config';
import type { ApiErrorBody } from '../types';
import { tokenStore } from './tokenStore';

/** Thrown for any non-2xx API response so callers can branch on `code`. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorBody['error']['code'] | 'NETWORK_ERROR';
  readonly details?: Record<string, string[]>;

  constructor(
    status: number,
    code: ApiErrorBody['error']['code'] | 'NETWORK_ERROR',
    message: string,
    details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Sent as the `Idempotency-Key` header for transaction writes. */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/**
 * Thin fetch wrapper: attaches the bearer token, serialises JSON, and
 * normalises backend errors into `ApiError`. Never swallows failures — a
 * rejected promise must be treated as "not saved" by the UI.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, idempotencyKey, signal } = options;
  const token = await tokenStore.get();

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Tidak dapat terhubung ke server.');
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = payload as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      parsed?.error?.code ?? 'SERVER_ERROR',
      parsed?.error?.message ?? `Permintaan gagal (${response.status}).`,
      parsed?.error?.details,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown, idempotencyKey?: string) =>
    request<T>(path, { method: 'POST', body, idempotencyKey }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
