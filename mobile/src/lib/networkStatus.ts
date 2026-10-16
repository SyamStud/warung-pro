import { Network } from '@capacitor/network';
import { onlineManager } from '@tanstack/react-query';

let initialized = false;

/**
 * Wire TanStack Query's online manager to the device network state.
 *
 * Once connected, queries automatically refetch on reconnect and paused
 * mutations resume — so the UI never presents failed writes as saved.
 */
export function initNetworkStatus(): void {
  if (initialized) return;
  initialized = true;

  onlineManager.setEventListener((setOnline) => {
    const listener = Network.addListener('networkStatusChange', (status) => {
      setOnline(status.connected);
    });

    void Network.getStatus().then((status) => setOnline(status.connected));

    return () => {
      void listener.then((handle) => handle.remove());
    };
  });
}
