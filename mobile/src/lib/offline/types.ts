import type { ProductInput } from '../../api/products';

export interface ProductCreatePayload {
  tempId: number;
  input: ProductInput;
  idempotencyKey: string;
}

export interface ProductUpdatePayload {
  id: number;
  input: Partial<ProductInput>;
}

export interface ProductArchivePayload {
  id: number;
}

export type OutboxType = 'product.create' | 'product.update' | 'product.archive';

export interface OutboxItem {
  id: string;
  type: OutboxType;
  payload: ProductCreatePayload | ProductUpdatePayload | ProductArchivePayload;
  createdAt: string;
  attempts: number;
  status: 'pending' | 'failed';
  lastError: string | null;
}
