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
