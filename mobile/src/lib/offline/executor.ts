import { productsApi } from '../../api/products';
import { ApiError } from '../http';
import type {
  OutboxItem,
  ProductArchivePayload,
  ProductCreatePayload,
  ProductUpdatePayload,
} from './types';

/**
 * Perform the queued write against the API. Throwing keeps the item in the
 * queue; returning resolves it.
 */
export async function executeOutboxItem(item: OutboxItem): Promise<void> {
  switch (item.type) {
    case 'product.create': {
      const payload = item.payload as ProductCreatePayload;
      await productsApi.create(payload.input, payload.idempotencyKey);
      return;
    }
    case 'product.update': {
      const payload = item.payload as ProductUpdatePayload;
      await productsApi.update(payload.id, payload.input);
      return;
    }
    case 'product.archive': {
      const payload = item.payload as ProductArchivePayload;
      try {
        await productsApi.archive(payload.id);
      } catch (error) {
        // Already archived on the server — nothing left to do.
        if (error instanceof ApiError && error.code === 'NOT_FOUND') return;
        throw error;
      }
      return;
    }
  }
}
