import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import UpdateBanner from './UpdateBanner';
import type { AppRelease } from '../types';

const latest = vi.fn<() => Promise<{ data: AppRelease }>>();
const installedBuild = vi.fn<() => Promise<number | null>>();

vi.mock('../api/releases', () => ({
  releasesApi: { latest: () => latest() },
}));

vi.mock('../lib/appVersion', () => ({
  installedBuild: () => installedBuild(),
}));

const release = (overrides: Partial<AppRelease> = {}): AppRelease => ({
  version_code: 2,
  version_name: '1.1.0',
  notes: 'Pemindai lebih cepat',
  size_bytes: 36_700_160,
  sha256: 'abc',
  published_at: '2026-10-17T09:00:00+07:00',
  download_url: 'http://host/api/v1/app/release/download?version_code=2',
  ...overrides,
});

function renderBanner() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <UpdateBanner />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  installedBuild.mockResolvedValue(1);
  latest.mockResolvedValue({ data: release() });
});

test('menampilkan tawaran pembaruan beserta catatan rilis dan ukurannya', async () => {
  renderBanner();

  await waitFor(() => expect(screen.getByText('Versi 1.1.0 tersedia')).toBeTruthy());
  expect(screen.getByText('Pemindai lebih cepat')).toBeTruthy();
  expect(screen.getByText(/35 MB/)).toBeTruthy();
});

test('tombol Perbarui menautkan ke berkas versi tersebut', async () => {
  renderBanner();

  const link = await screen.findByRole('link', { name: /perbarui/i });

  expect(link.getAttribute('href')).toBe(release().download_url);
});

test('tidak menampilkan apa pun saat aplikasi sudah versi terbaru', async () => {
  installedBuild.mockResolvedValue(2);
  latest.mockResolvedValue({ data: release() });

  renderBanner();

  await waitFor(() => expect(latest).toHaveBeenCalled());
  expect(screen.queryByText(/tersedia/)).toBe(null);
});

test('tidak menampilkan apa pun saat server belum punya rilis (404)', async () => {
  latest.mockRejectedValue(new Error('NOT_FOUND'));

  renderBanner();

  await waitFor(() => expect(latest).toHaveBeenCalled());
  expect(screen.queryByText(/tersedia/)).toBe(null);
});

test('"Nanti" menyembunyikan tawaran untuk versi itu', async () => {
  renderBanner();

  await screen.findByText('Versi 1.1.0 tersedia');
  screen.getByText('Nanti').click();

  await waitFor(() => expect(screen.queryByText('Versi 1.1.0 tersedia')).toBe(null));
});

test('versi yang lebih baru tetap ditawarkan walau versi sebelumnya dijawab "Nanti"', async () => {
  renderBanner();
  await screen.findByText('Versi 1.1.0 tersedia');
  screen.getByText('Nanti').click();
  await waitFor(() => expect(screen.queryByText('Versi 1.1.0 tersedia')).toBe(null));

  // Versi berikutnya terbit; tawaran harus muncul lagi — inilah cara pengguna
  // yang melewatkan satu pembaruan tetap mendapatkannya.
  latest.mockResolvedValue({ data: release({ version_code: 3, version_name: '1.2.0' }) });
  renderBanner();

  await waitFor(() => expect(screen.getByText('Versi 1.2.0 tersedia')).toBeTruthy());
});
