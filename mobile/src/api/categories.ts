import { api } from '../lib/http';
import type { Category } from '../types';

export const categoriesApi = {
  list: (signal?: AbortSignal) => api.get<{ data: Category[] }>('/categories', signal),

  create: (name: string) => api.post<{ data: Category }>('/categories', { name }),
};
