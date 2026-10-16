import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './http';

/**
 * Shared TanStack Query client.
 *
 * Retries only transient failures (network / 5xx) — never retry 4xx, so a
 * rejected write stays visibly failed instead of silently looping.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Pause queries while offline and refetch once the connection returns.
      networkMode: 'online',
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (error.status === 401 || error.status === 403) return false;
          if (error.status >= 400 && error.status < 500) return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      // Never retry a write automatically; a timed-out payment could duplicate.
      retry: false,
      networkMode: 'online',
    },
  },
});
