import { api } from '../lib/http';
import type { AppRelease } from '../types';

/**
 * Published builds of this app.
 *
 * The endpoint is public: the check runs while the app starts, before anyone
 * has logged in, and an app that cannot reach it simply shows no update notice.
 */
export const releasesApi = {
  /** Newest published build; rejects with `NOT_FOUND` until one is published. */
  latest: (signal?: AbortSignal) => api.get<{ data: AppRelease }>('/app/release', signal),
};
