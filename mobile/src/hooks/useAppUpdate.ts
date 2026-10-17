import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { releasesApi } from '../api/releases';
import { isUpdateAvailable, readDismissedVersion, rememberDismissedVersion } from '../lib/appUpdate';
import { installedBuild } from '../lib/appVersion';
import { appKeys } from '../lib/queryKeys';
import type { AppRelease } from '../types';

interface AppUpdateState {
  /** A newer build worth offering, or null when there is nothing to show. */
  release: AppRelease | null;
  /** Hide this build; an even newer one is offered again. */
  dismiss: () => void;
}

/**
 * Asks once per app start whether the server has a newer build than the one
 * installed.
 *
 * Every failure path is silent on purpose — offline, nothing published yet, or
 * an older backend must never interfere with using the app.
 */
export function useAppUpdate(): AppUpdateState {
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

  const candidate = query.data?.data ?? null;
  const offered =
    isUpdateAvailable(installed, candidate) && candidate.version_code !== dismissed ? candidate : null;

  const dismiss = useCallback(() => {
    if (candidate === null) return;

    setDismissed(candidate.version_code);
    void rememberDismissedVersion(candidate.version_code);
  }, [candidate]);

  return { release: offered, dismiss };
}
