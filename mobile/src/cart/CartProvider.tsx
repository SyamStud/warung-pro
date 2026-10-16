import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '../api/transactions';
import { DEFAULT_PAYMENT_METHOD, type PaymentMethod, type Product } from '../types';
import {
  addProductToCart,
  changeLineQuantity,
  computeTotals,
  removeLine,
  type CartLine,
} from '../lib/cart';
import { transactionKeys } from '../lib/queryKeys';
import { ApiError, describeDetails } from '../lib/http';
import { CartContext, type CartContextValue, type CheckoutResult } from './context';

function uuid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `trx-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/**
 * One cart for the whole app: the POS page builds it, Cek Harga can add to it,
 * and Pembayaran pays for it. Held in memory only.
 */
export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  const [lines, setLines] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [paid, setPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(DEFAULT_PAYMENT_METHOD);

  // One idempotency key per cart contents, so a retried checkout never creates
  // two transactions; a changed cart starts a new key.
  const checkoutKey = useRef(uuid());
  useEffect(() => {
    checkoutKey.current = uuid();
  }, [lines, discount]);

  const add = useCallback((product: Product) => {
    // A product that has not reached the server yet cannot be sold.
    if (product.id < 0) return false;

    setLines((current) => addProductToCart(current, product));
    return true;
  }, []);

  const changeQuantity = useCallback((id: number, delta: number) => {
    setLines((current) => changeLineQuantity(current, id, delta));
  }, []);

  const remove = useCallback((id: number) => {
    setLines((current) => removeLine(current, id));
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setDiscount('');
    setPaid('');
    setPaymentMethod(DEFAULT_PAYMENT_METHOD);
  }, []);

  const totals = useMemo(
    () => computeTotals(lines, Number(discount) || 0, Number(paid) || 0),
    [lines, discount, paid],
  );

  const checkout = useCallback(async (): Promise<CheckoutResult> => {
    try {
      const { data } = await transactionsApi.create(
        {
          items: lines.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
          discount_amount: totals.discountAmount,
          paid_amount: totals.paidAmount,
          payment_method: paymentMethod,
        },
        checkoutKey.current,
      );

      await queryClient.invalidateQueries({ queryKey: transactionKeys.all });
      clear();

      return { ok: true, transactionId: data.id };
    } catch (error) {
      const message =
        error instanceof ApiError
          ? (describeDetails(error.details) ?? error.message)
          : 'Gagal menyimpan transaksi.';

      return { ok: false, error: message };
    }
  }, [lines, totals, paymentMethod, queryClient, clear]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      discount,
      paid,
      paymentMethod,
      totals,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      add,
      changeQuantity,
      remove,
      clear,
      setDiscount,
      setPaid,
      setPaymentMethod,
      checkout,
    }),
    [lines, discount, paid, paymentMethod, totals, add, changeQuantity, remove, clear, checkout],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
