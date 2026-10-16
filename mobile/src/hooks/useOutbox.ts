import { useSyncExternalStore } from 'react';
import { outbox } from '../lib/offline/outbox';
import { buildOverlay } from '../lib/offline/products';
import { describeProductConflicts } from '../lib/offline/conflicts';

/** Subscribe to the durable write queue and derive its visible effect. */
export function useOutbox() {
  const version = useSyncExternalStore(
    (onChange) => outbox.subscribe(onChange),
    () => outbox.version,
  );

  const items = outbox.list();

  return {
    version,
    items,
    overlay: buildOverlay(items),
    conflicts: describeProductConflicts(items),
    pendingCount: outbox.pendingCount,
    failedCount: outbox.failedCount,
    conflictCount: outbox.conflictCount,
    isFlushing: outbox.isFlushing,
    retryFailed: () => outbox.retryFailed(),
    discardFailed: () => outbox.discardFailed(),
    resolveKeepServer: (id: string) => outbox.resolveConflictKeepServer(id),
    resolveKeepMine: (id: string) => outbox.resolveConflictKeepMine(id),
  };
}
