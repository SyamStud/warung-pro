import type { ProductInput } from '../../api/products';
import type { Product } from '../../types';

export interface ProductCreatePayload {
  tempId: number;
  input: ProductInput;
  idempotencyKey: string;
}

export interface ProductUpdatePayload {
  id: number;
  input: Partial<ProductInput>;
  /** The product `version` this edit was based on (for conflict detection). */
  baseVersion?: number;
  /** Server's current row, set when the edit collided with another device. */
  conflict?: Product;
  /** Set when the user chose to overwrite the newer server version. */
  force?: boolean;
}

export interface ProductArchivePayload {
  id: number;
}

export type OutboxType = 'product.create' | 'product.update' | 'product.archive';

/**
 * `conflict` means the server rejected the write because another device
 * changed the same product first — the user has to pick a winner.
 */
export type OutboxStatus = 'pending' | 'failed' | 'conflict';

export interface OutboxItem {
  id: string;
  type: OutboxType;
  payload: ProductCreatePayload | ProductUpdatePayload | ProductArchivePayload;
  createdAt: string;
  attempts: number;
  status: OutboxStatus;
  lastError: string | null;
}
