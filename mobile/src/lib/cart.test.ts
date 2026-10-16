import { expect, test } from 'vitest';
import {
  addProductToCart,
  changeLineQuantity,
  computeTotals,
  removeLine,
  type CartLine,
} from './cart';
import type { Product } from '../types';

function product(id: number, price: number, name = `Produk ${id}`): Product {
  return {
    id,
    name,
    sku: `PRD-${id}`,
    barcode: null,
    unit: 'pcs',
    selling_price: price,
    category_id: null,
    notes: null,
    is_active: true,
  };
}

test('addProductToCart ignores products that are not synced yet', () => {
  expect(addProductToCart([], product(-1, 5000))).toHaveLength(0);
});

test('addProductToCart bumps the quantity of an existing line', () => {
  let lines: CartLine[] = [];
  lines = addProductToCart(lines, product(1, 4000));
  lines = addProductToCart(lines, product(1, 4000));

  expect(lines).toHaveLength(1);
  expect(lines[0].quantity).toBe(2);
});

test('changeLineQuantity removes a line when the quantity reaches zero', () => {
  const lines: CartLine[] = [{ product: product(1, 4000), quantity: 1 }];

  expect(changeLineQuantity(lines, 1, -1)).toHaveLength(0);
  expect(changeLineQuantity(lines, 1, 1)[0].quantity).toBe(2);
});

test('removeLine drops only the matching product', () => {
  const lines: CartLine[] = [
    { product: product(1, 4000), quantity: 1 },
    { product: product(2, 5000), quantity: 1 },
  ];

  const result = removeLine(lines, 1);
  expect(result).toHaveLength(1);
  expect(result[0].product.id).toBe(2);
});

test('computeTotals sums lines and applies the discount', () => {
  const lines: CartLine[] = [
    { product: product(1, 4000), quantity: 2 },
    { product: product(2, 5000), quantity: 1 },
  ];

  const totals = computeTotals(lines, 1500, 20000);

  expect(totals.subtotal).toBe(13000);
  expect(totals.discountAmount).toBe(1500);
  expect(totals.total).toBe(11500);
  expect(totals.changeAmount).toBe(8500);
});

test('computeTotals clamps negative and non-numeric inputs', () => {
  const totals = computeTotals([{ product: product(1, 4000), quantity: 1 }], -500, Number.NaN);

  expect(totals.discountAmount).toBe(0);
  expect(totals.paidAmount).toBe(0);
  expect(totals.changeAmount).toBe(-4000);
});
