import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';

/** Reactive online/offline status, shared with TanStack Query. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe((isOnline) => setOnline(isOnline)), []);

  return online;
}
