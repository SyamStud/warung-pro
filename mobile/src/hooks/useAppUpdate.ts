import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { releasesApi } from '../api/releases';
import {
  isUpdateAvailable,
  readDismissedVersion,
  readSeenVersion,
  rememberDismissedVersion,
  rememberSeenVersion,
} from '../lib/appUpdate';
import { installedBuild } from '../lib/appVersion';
import { appKeys } from '../lib/queryKeys';
import type { AppRelease } from '../types';

interface AppUpdateState {
  /** A newer build worth offering, or null when there is nothing to show. */
  release: AppRelease | null;
  /** True while this build has not been opened in Notifikasi yet. */
  unseen: boolean;
  /** Hide this build; an even newer one is offered again. */
  dismiss: () => void;
  /** Record this build as read, clearing the dot on the bell. */
  markSeen: () => void;
}

/**
 * Asks once per app start whether the server has a newer build than the one
 * installed, and remembers how the user answered.
 *
 * Every failure path is silent on purpose — offline, nothing published yet, or
 * an older backend must never interfere with using the app.
 */
export function useAppUpdate(): AppUpdateState {
  const queryClient = useQueryClient();
  const [installed, setInstalled] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const [build, seen] = await Promise.all([installedBuild(), readDismissedVersion()]);

      if (!alive) return;

      setInstalled(build);
      setDismissed(seen);
      setReady(true);
    })();

    return () => {
      alive = false;
    };
  }, []);

  const query = useQuery({
    queryKey: appKeys.release,
    queryFn: ({ signal }) => releasesApi.latest(signal),
    // Nothing to compare against (browser) or nothing installed yet → don't ask.
    enabled: ready && installed !== null,
    retry: false,
    staleTime: 30 * 60 * 1000,
  });

  // Kept in the cache rather than local state so the bell on Beranda and the
  // Notifikasi page clear the dot together.
  const seenQuery = useQuery({
    queryKey: appKeys.notifSeen,
    queryFn: () => readSeenVersion(),
    enabled: ready,
    staleTime: Infinity,
  });
  const seen = seenQuery.data ?? null;

  const candidate = query.data?.data ?? null;
  const offered =
    isUpdateAvailable(installed, candidate) && candidate.version_code !== dismissed ? candidate : null;

  const dismiss = useCallback(() => {
    if (candidate === null) return;

    setDismissed(candidate.version_code);
    void rememberDismissedVersion(candidate.version_code);
  }, [candidate]);

  const markSeen = useCallback(() => {
    if (offered === null) return;

    queryClient.setQueryData(appKeys.notifSeen, offered.version_code);
    void rememberSeenVersion(offered.version_code);
  }, [offered, queryClient]);

  return {
    release: offered,
    unseen: offered !== null && (seen === null || offered.version_code > seen),
    dismiss,
    markSeen,
  };
}
