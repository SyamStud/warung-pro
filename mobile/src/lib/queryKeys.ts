import type { ProductQuery } from '../api/products';
import type { TransactionQuery } from '../api/transactions';

export const productKeys = {
  all: ['products'] as const,
  list: (query: ProductQuery) => ['products', 'list', query] as const,
  detail: (id: number) => ['products', 'detail', id] as const,
};

export const categoryKeys = {
  all: ['categories'] as const,
};

export const transactionKeys = {
  all: ['transactions'] as const,
  list: (query: TransactionQuery = {}) => ['transactions', 'list', query] as const,
  detail: (id: number) => ['transactions', 'detail', id] as const,
};

export const appKeys = {
  /** The newest build published on the server (update notice). */
  release: ['app', 'release'] as const,
  /**
   * The newest build the user has already opened Notifikasi for. Lives in the
   * cache so the bell on Beranda and the Notifikasi page agree immediately.
   */
  notifSeen: ['app', 'notif-seen'] as const,
};
