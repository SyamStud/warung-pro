import type { ProductQuery } from '../api/products';

export const productKeys = {
  all: ['products'] as const,
  list: (query: ProductQuery) => ['products', 'list', query] as const,
  detail: (id: number) => ['products', 'detail', id] as const,
};

export const categoryKeys = {
  all: ['categories'] as const,
};
