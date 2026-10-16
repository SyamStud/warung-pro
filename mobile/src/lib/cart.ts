import type { Product } from '../types';

export interface CartLine {
  product: Product;
  quantity: number;
}

/** Add a product, bumping the quantity if already in the cart. */
export function addProductToCart(lines: CartLine[], product: Product): CartLine[] {
  // A product that has not reached the server yet cannot be sold.
  if (product.id < 0) return lines;

  const existing = lines.find((line) => line.product.id === product.id);
  if (existing) {
    return lines.map((line) =>
      line.product.id === product.id ? { ...line, quantity: line.quantity + 1 } : line,
    );
  }

  return [...lines, { product, quantity: 1 }];
}

/** Adjust a line by ±1, dropping it when the quantity reaches zero. */
export function changeLineQuantity(lines: CartLine[], id: number, delta: number): CartLine[] {
  return lines.flatMap((line) => {
    if (line.product.id !== id) return [line];
    const quantity = line.quantity + delta;
    return quantity <= 0 ? [] : [{ ...line, quantity }];
  });
}

export function removeLine(lines: CartLine[], id: number): CartLine[] {
  return lines.filter((line) => line.product.id !== id);
}

export interface CartTotals {
  subtotal: number;
  discountAmount: number;
  total: number;
  paidAmount: number;
  changeAmount: number;
}

/**
 * Compute the cart totals. This is a display preview only — the backend is the
 * source of truth and recomputes everything from its own prices on checkout.
 */
export function computeTotals(lines: CartLine[], discount: number, paid: number): CartTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.product.selling_price * line.quantity, 0);
  const discountAmount = Math.max(0, Math.trunc(discount) || 0);
  const total = subtotal - discountAmount;
  const paidAmount = Math.max(0, Math.trunc(paid) || 0);

  return { subtotal, discountAmount, total, paidAmount, changeAmount: paidAmount - total };
}
