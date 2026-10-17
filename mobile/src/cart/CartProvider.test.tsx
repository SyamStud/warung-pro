import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/context';
import type { Product } from '../types';
import { CartProvider } from './CartProvider';
import { useCart } from './useCart';

const product: Product = {
  id: 1,
  name: 'Teh Kotak 200ml',
  sku: '8991234567891',
  unit: 'pcs',
  selling_price: 5_000,
  category_id: null,
  notes: null,
  is_active: true,
  version: 1,
};

function Probe() {
  const cart = useCart();

  return (
    <div>
      <span data-testid="state">
        {cart.lines.length}|{cart.discount}|{cart.paid}|{cart.paymentMethod}
      </span>
      <button type="button" onClick={() => cart.add(product)}>
        tambah
      </button>
      <button
        type="button"
        onClick={() => {
          cart.setDiscount('500');
          cart.setPaid('10000');
          cart.setPaymentMethod('non_cash');
        }}
      >
        isi
      </button>
    </div>
  );
}

function auth(isAuthenticated: boolean): AuthContextValue {
  return {
    user: isAuthenticated ? { id: 1, name: 'Demo', email: 'demo@warung.test' } : null,
    isLoading: false,
    isAuthenticated,
    login: async () => undefined,
    register: async () => undefined,
    logout: async () => undefined,
  };
}

function Harness({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <AuthContext.Provider value={auth(isAuthenticated)}>
        <CartProvider>
          <Probe />
        </CartProvider>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

const state = () => screen.getByTestId('state').textContent;

test('keranjang tetap utuh selama sesi berjalan', () => {
  render(<Harness isAuthenticated />);

  fireEvent.click(screen.getByText('tambah'));
  fireEvent.click(screen.getByText('isi'));

  expect(state()).toBe('1|500|10000|non_cash');
});

test('keranjang dikosongkan begitu pengguna keluar', () => {
  const { rerender } = render(<Harness isAuthenticated />);

  fireEvent.click(screen.getByText('tambah'));
  fireEvent.click(screen.getByText('isi'));
  expect(state()).toBe('1|500|10000|non_cash');

  rerender(<Harness isAuthenticated={false} />);

  // Akun berikutnya di HP yang sama tidak boleh mewarisi penjualan setengah jalan.
  expect(state()).toBe('0|||cash');
});
