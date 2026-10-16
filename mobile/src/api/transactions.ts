import { api } from '../lib/http';
import type { Paginated, PaymentMethod, Transaction } from '../types';

export interface TransactionItemInput {
  product_id: number;
  quantity: number;
}

export interface TransactionInput {
  items: TransactionItemInput[];
  discount_amount?: number;
  paid_amount: number;
  payment_method?: PaymentMethod;
}

export interface TransactionQuery {
  /** Matches the transaction number. */
  search?: string;
  payment_method?: PaymentMethod | 'all';
  page?: number;
  per_page?: number;
}

function toQueryString(query: TransactionQuery): string {
  const params = new URLSearchParams();
  if (query.search) params.set('search', query.search);
  if (query.payment_method && query.payment_method !== 'all') {
    params.set('payment_method', query.payment_method);
  }
  if (query.page) params.set('page', String(query.page));
  if (query.per_page) params.set('per_page', String(query.per_page));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const transactionsApi = {
  list: (query: TransactionQuery = {}, signal?: AbortSignal) =>
    api.get<Paginated<Transaction>>(`/transactions${toQueryString(query)}`, signal),

  get: (id: number, signal?: AbortSignal) =>
    api.get<{ data: Transaction }>(`/transactions/${id}`, signal),

  receipt: (id: number, signal?: AbortSignal) =>
    api.get<{ data: Transaction }>(`/transactions/${id}/receipt`, signal),

  create: (input: TransactionInput, idempotencyKey?: string) =>
    api.post<{ data: Transaction }>('/transactions', input, idempotencyKey),
};
