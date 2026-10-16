import { createContext } from 'react';
import type { PaymentMethod, Product } from '../types';
import type { CartLine, CartTotals } from '../lib/cart';

export interface CheckoutResult {
  ok: boolean;
  transactionId?: number;
  error?: string;
}

export interface CartContextValue {
  lines: CartLine[];
  /** Raw text fields, so an empty box stays empty while typing. */
  discount: string;
  paid: string;
  paymentMethod: PaymentMethod;
  totals: CartTotals;
  itemCount: number;
  /** Add one unit; returns false when the product is not sellable yet. */
  add: (product: Product) => boolean;
  changeQuantity: (id: number, delta: number) => void;
  remove: (id: number) => void;
  clear: () => void;
  setDiscount: (value: string) => void;
  setPaid: (value: string) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  /** Submit the sale to the server. The backend recomputes every amount. */
  checkout: () => Promise<CheckoutResult>;
}

export const CartContext = createContext<CartContextValue | null>(null);
