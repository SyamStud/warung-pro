import { onlineManager } from '@tanstack/react-query';
import { productsApi, type ProductInput } from '../../api/products';
import type { Product } from '../../types';
import { ApiError, conflictRecord } from '../http';
import { outbox } from './outbox';
import type {
  OutboxItem,
  OutboxType,
  ProductArchivePayload,
  ProductCreatePayload,
  ProductUpdatePayload,
} from './types';

function uuid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `local-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

let tempSequence = 0;

function nextTempId(): number {
  tempSequence += 1;
  return -(Date.now() + tempSequence);
}

function makeItem(type: OutboxType, payload: OutboxItem['payload']): OutboxItem {
  return {
    id: uuid(),
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
    lastError: null,
  };
}

function findQueuedCreate(tempId: number): OutboxItem | undefined {
  return outbox
    .list()
    .find(
      (item) =>
        item.type === 'product.create' &&
        (item.payload as ProductCreatePayload).tempId === tempId,
    );
}

function findQueuedUpdate(id: number): OutboxItem | undefined {
  return outbox
    .list()
    .find(
      (item) => item.type === 'product.update' && (item.payload as ProductUpdatePayload).id === id,
    );
}

function findQueuedArchive(id: number): OutboxItem | undefined {
  return outbox
    .list()
    .find(
      (item) => item.type === 'product.archive' && (item.payload as ProductArchivePayload).id === id,
    );
}

/**
 * Outcome of a save. `conflict` means another device changed the same product
 * first, so the write was parked in the outbox for the user to resolve.
 */
export type SaveResult = 'saved' | 'queued' | 'conflict';

/**
 * Create or update a product. Sends immediately when online; otherwise (or on a
 * network failure) the write is queued durably and reported as `queued`.
 * Validation errors (4xx) still throw so the form can show them, while a
 * concurrent edit on another device is reported as `conflict`.
 */
export async function saveProduct(
  existing: Product | null,
  input: ProductInput,
): Promise<SaveResult> {
  // Editing a product that has not reached the server yet.
  if (existing && existing.id < 0) {
    const queued = findQueuedCreate(existing.id);
    if (queued) {
      await outbox.enqueue({
        ...queued,
        payload: { ...(queued.payload as ProductCreatePayload), input },
      });
    }
    return 'queued';
  }

  if (onlineManager.isOnline()) {
    try {
      if (existing) {
        await productsApi.update(existing.id, input, { version: existing.version });
      } else {
        await productsApi.create(input, uuid());
      }
      return 'saved';
    } catch (error) {
      if (error instanceof ApiError && error.code === 'CONFLICT' && existing) {
        await enqueueConflict(existing, input, error);
        return 'conflict';
      }

      if (!(error instanceof ApiError && error.code === 'NETWORK_ERROR')) throw error;
    }
  }

  await enqueueSave(existing, input);
  return 'queued';
}

/** Park an edit that collided with a change made on another device. */
async function enqueueConflict(
  existing: Product,
  input: ProductInput,
  error: ApiError,
): Promise<void> {
  const queued = findQueuedUpdate(existing.id);

  await outbox.enqueue({
    id: queued?.id ?? uuid(),
    type: 'product.update',
    payload: {
      id: existing.id,
      input,
      baseVersion: existing.version,
      conflict: conflictRecord<Product>(error) ?? undefined,
    },
    createdAt: queued?.createdAt ?? new Date().toISOString(),
    attempts: 0,
    status: 'conflict',
    lastError: error.message,
  });
}

async function enqueueSave(existing: Product | null, input: ProductInput): Promise<void> {
  if (existing) {
    const queued = findQueuedUpdate(existing.id);
    if (queued) {
      const payload = queued.payload as ProductUpdatePayload;
      await outbox.enqueue({
        ...queued,
        // A fresh edit re-checks against the server rather than reusing an
        // earlier "keep mine" decision.
        status: 'pending',
        lastError: null,
        payload: {
          ...payload,
          input: { ...payload.input, ...input },
          baseVersion: payload.baseVersion ?? existing.version,
          conflict: undefined,
          force: false,
        },
      });
      return;
    }

    await outbox.enqueue(
      makeItem('product.update', {
        id: existing.id,
        input,
        baseVersion: existing.version,
      }),
    );
    return;
  }

  await outbox.enqueue(
    makeItem('product.create', { tempId: nextTempId(), input, idempotencyKey: uuid() }),
  );
}

/** Archive a product, queuing the request if offline. */
export async function archiveProduct(product: Product): Promise<'saved' | 'queued'> {
  // Never synced — just drop the pending create.
  if (product.id < 0) {
    const queued = findQueuedCreate(product.id);
    if (queued) await outbox.remove(queued.id);
    return 'queued';
  }

  if (onlineManager.isOnline()) {
    try {
      await productsApi.archive(product.id);
      return 'saved';
    } catch (error) {
      if (!(error instanceof ApiError && error.code === 'NETWORK_ERROR')) throw error;
    }
  }

  const pendingUpdate = findQueuedUpdate(product.id);
  if (pendingUpdate) await outbox.remove(pendingUpdate.id);

  if (!findQueuedArchive(product.id)) {
    await outbox.enqueue(makeItem('product.archive', { id: product.id }));
  }
  return 'queued';
}

export interface ProductOverlay {
  created: Product[];
  updates: Map<number, ProductInput>;
  archived: Set<number>;
}

/** Derive the visible effect of queued changes from the outbox. */
export function buildOverlay(items: OutboxItem[]): ProductOverlay {
  const created: Product[] = [];
  const updates = new Map<number, ProductInput>();
  const archived = new Set<number>();

  for (const item of items) {
    if (item.type === 'product.create') {
      created.push(tempProduct(item.payload as ProductCreatePayload));
    } else if (item.type === 'product.update') {
      const payload = item.payload as ProductUpdatePayload;
      updates.set(payload.id, payload.input as ProductInput);
    } else {
      archived.add((item.payload as ProductArchivePayload).id);
    }
  }

  return { created, updates, archived };
}

/** Apply queued changes on top of server data so the UI reflects reality. */
export function applyOverlay(
  products: Product[],
  overlay: ProductOverlay,
  createdFilter?: (product: Product) => boolean,
): Product[] {
  const created = createdFilter ? overlay.created.filter(createdFilter) : overlay.created;

  const merged = products
    .filter((product) => !overlay.archived.has(product.id))
    .map((product) => {
      const patch = overlay.updates.get(product.id);
      return patch ? ({ ...product, ...patch } as Product) : product;
    });

  return [...created, ...merged];
}

function tempProduct(payload: ProductCreatePayload): Product {
  const { input } = payload;
  return {
    id: payload.tempId,
    name: input.name,
    sku: input.sku ?? 'Menunggu sinkron',
    unit: input.unit,
    selling_price: input.selling_price,
    category_id: input.category_id ?? null,
    notes: input.notes ?? null,
    is_active: input.is_active ?? true,
    version: 0,
  };
}
