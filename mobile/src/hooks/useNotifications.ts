import { useCallback, useMemo } from 'react';
import { useAppUpdate } from './useAppUpdate';
import { formatBytes, formatDateTime } from '../lib/format';
import type { AppRelease } from '../types';

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  /** Small print under the body: size and publication date. */
  meta: string | null;
  /** Primary action ("Perbarui") — a link the system browser opens. */
  action: { label: string; href: string } | null;
  /** Secondary action ("Nanti") that removes this notification. */
  dismiss: (() => void) | null;
}

interface NotificationsState {
  /** Newest first. */
  items: NotificationItem[];
  /** How many the user has not opened Notifikasi for yet. */
  unread: number;
  /** Called when the list is shown. */
  markAllSeen: () => void;
}

/** e.g. "Ukuran 35 MB · Terbit 17 Okt 2026, 12.56". */
function describe(release: AppRelease): string | null {
  const size = formatBytes(release.size_bytes);

  const parts = [
    size ? `Ukuran ${size}` : null,
    release.published_at ? `Terbit ${formatDateTime(release.published_at)}` : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * The app's notification centre. Today it carries one kind of message — a build
 * published after the one installed — kept as a list so further kinds can join
 * without a new screen.
 */
export function useNotifications(): NotificationsState {
  const { release, unseen, dismiss, markSeen } = useAppUpdate();

  const items = useMemo<NotificationItem[]>(() => {
    if (release === null) return [];

    return [
      {
        id: `update-${release.version_code}`,
        title: `Versi ${release.version_name} tersedia`,
        body: release.notes,
        meta: describe(release),
        action: { label: 'Perbarui', href: release.download_url },
        dismiss,
      },
    ];
  }, [release, dismiss]);

  const markAllSeen = useCallback(() => {
    markSeen();
  }, [markSeen]);

  return { items, unread: unseen ? items.length : 0, markAllSeen };
}
