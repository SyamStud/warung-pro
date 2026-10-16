/**
 * Domain types shared across the app.
 *
 * These mirror the Laravel API JSON exactly (snake_case), as defined in
 * PLAN.md §5–6. Keep them in sync with the backend resources when the
 * contract changes.
 */

export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Category {
  id: number;
  name: string;
}

export interface Product {
  id: number;
  name: string;
  /**
   * The product's code. SKU and barcode are the same thing here: it may be
   * auto-generated, typed by hand, or filled from a scan.
   */
  sku: string;
  unit: string;
  selling_price: number;
  category_id: number | null;
  notes: string | null;
  is_active: boolean;
  /** Server revision, used to detect edits made on another device. */
  version: number;
  created_at?: string;
  updated_at?: string;
}

export interface TransactionItem {
  id: number;
  product_id: number | null;
  product_name: string;
  sku: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

/** How a sale was paid. */
export type PaymentMethod = 'cash' | 'non_cash';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Tunai',
  non_cash: 'Non Tunai',
};

/** Badge tint per method: cash reads as "money in hand" (green), transfers stay neutral. */
export const PAYMENT_METHOD_BADGES: Record<PaymentMethod, string> = {
  cash: 'badge--green',
  non_cash: 'badge--grey',
};

export const DEFAULT_PAYMENT_METHOD: PaymentMethod = 'cash';

export function paymentMethodLabel(method: PaymentMethod | undefined): string {
  return method ? PAYMENT_METHOD_LABELS[method] : PAYMENT_METHOD_LABELS.cash;
}

export function paymentMethodBadge(method: PaymentMethod | undefined): string {
  return PAYMENT_METHOD_BADGES[method ?? DEFAULT_PAYMENT_METHOD];
}

export interface Transaction {
  id: number;
  transaction_number: string;
  status: 'paid' | 'void';
  subtotal: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  change_amount: number;
  payment_method: PaymentMethod;
  items?: TransactionItem[];
  created_at: string;
}

/** Laravel paginator shape (`data` + `meta`). */
export interface Paginated<T> {
  data: T[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

/** Consistent API error envelope (PLAN.md §6.5). */
export interface ApiErrorBody {
  error: {
    code:
      | 'UNAUTHENTICATED'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'VALIDATION_ERROR'
      | 'CONFLICT'
      | 'RATE_LIMITED'
      | 'SERVER_ERROR'
      | 'REQUEST_ERROR';
    message: string;
    /**
     * Validation errors map field -> messages. A `CONFLICT` carries the
     * server's current record under `current` instead.
     */
    details?: Record<string, unknown>;
  };
}
