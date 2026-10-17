import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import ProductFormModal from './ProductFormModal';
import type { Product } from '../types';

const saveProduct = vi.fn<(product: unknown, input: Record<string, unknown>) => Promise<string>>();

vi.mock('../lib/offline/products', () => ({
  saveProduct: (product: unknown, input: Record<string, unknown>) => saveProduct(product, input),
}));

vi.mock('../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => true }));

// IonModal asli butuh framework delegate milik Ionic yang tidak ada di jsdom;
// isinya cukup dirender langsung supaya kolomnya bisa diuji.
vi.mock('@ionic/react', async () => {
  const actual = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');

  return {
    ...actual,
    IonModal: ({ isOpen, children }: { isOpen: boolean; children?: React.ReactNode }) =>
      isOpen ? <div>{children}</div> : null,
  };
});

const product = (overrides: Partial<Product> = {}): Product =>
  ({
    id: 1,
    name: 'Susu Ultra 250ml',
    sku: 'PRD-000009',
    unit: 'kotak',
    selling_price: 6500,
    category_id: null,
    is_active: true,
    version: 1,
    ...overrides,
  }) as Product;

function renderModal(edited: Product | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ProductFormModal
          isOpen
          product={edited}
          categories={[]}
          onDismiss={() => {}}
          onSaved={() => {}}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const priceField = () => screen.getByLabelText(/harga jual/i);

beforeEach(() => {
  vi.clearAllMocks();
  saveProduct.mockResolvedValue('created');
});

test('harga yang tersimpan ditampilkan dengan pemisah ribuan', () => {
  renderModal(product({ selling_price: 12000 }));

  expect(priceField()).toHaveValue('12.000');
});

test('mengetik harga menampilkan titik per ribuan', () => {
  renderModal();

  fireEvent.change(priceField(), { target: { value: '20000' } });

  expect(priceField()).toHaveValue('20.000');
});

test('nilai yang ditempel apa adanya tetap dirapikan jadi angka', () => {
  renderModal();

  fireEvent.change(priceField(), { target: { value: 'Rp 1.250.000' } });

  expect(priceField()).toHaveValue('1.250.000');
});

test('yang dikirim ke server tetap angka polos, bukan tampilan bertitik', async () => {
  renderModal();
  fireEvent.change(screen.getByPlaceholderText('Misal: Air Mineral 600ml'), {
    target: { value: 'Susu Kental Manis' },
  });
  fireEvent.change(priceField(), { target: { value: '12.500' } });

  fireEvent.click(screen.getByRole('button', { name: 'Simpan Produk' }));

  await waitFor(() => expect(saveProduct).toHaveBeenCalledTimes(1));
  expect(saveProduct.mock.calls[0][1]).toMatchObject({
    name: 'Susu Kental Manis',
    selling_price: 12500,
  });
});

test('harga kosong tidak dikirim dan dilaporkan di kolomnya', async () => {
  renderModal();
  fireEvent.change(screen.getByPlaceholderText('Misal: Air Mineral 600ml'), {
    target: { value: 'Tanpa Harga' },
  });

  fireEvent.click(screen.getByRole('button', { name: 'Simpan Produk' }));

  await waitFor(() => expect(screen.getByText('Harga wajib diisi')).toBeTruthy());
  expect(saveProduct).not.toHaveBeenCalled();
});
