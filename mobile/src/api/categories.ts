import { api } from '../lib/http';
import type { Category } from '../types';

export const categoriesApi = {
  list: (signal?: AbortSignal) => api.get<{ data: Category[] }>('/categories', signal),

  create: (name: string) => api.post<{ data: Category }>('/categories', { name }),

  rename: (id: number, name: string) =>
    api.patch<{ data: Category }>(`/categories/${id}`, { name }),

  /** Products in the category survive; their `category_id` becomes null. */
  remove: (id: number) => api.delete<void>(`/categories/${id}`),
};
