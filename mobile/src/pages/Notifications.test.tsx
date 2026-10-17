import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import Notifications from './Notifications';
import { readSeenVersion } from '../lib/appUpdate';
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

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Notifications />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  installedBuild.mockResolvedValue(1);
  latest.mockResolvedValue({ data: release() });
});

test('menampilkan kabar versi baru beserta catatan, ukuran dan tanggalnya', async () => {
  renderPage();

  await waitFor(() => expect(screen.getByText('Versi 1.1.0 tersedia')).toBeTruthy());
  expect(screen.getByText('Pemindai lebih cepat')).toBeTruthy();
  expect(screen.getByText(/Ukuran 35 MB/)).toBeTruthy();
  expect(screen.getByText(/Terbit/)).toBeTruthy();
});

test('tombol Perbarui menautkan ke berkas versi tersebut', async () => {
  renderPage();

  const link = await screen.findByRole('link', { name: /perbarui/i });

  expect(link.getAttribute('href')).toBe(release().download_url);
});

test('membuka halaman menandai kabar itu sudah dibaca', async () => {
  renderPage();

  await screen.findByText('Versi 1.1.0 tersedia');

  await waitFor(async () => expect(await readSeenVersion()).toBe(2));
});

test('"Nanti" menghilangkan kabar untuk versi itu', async () => {
  renderPage();

  await screen.findByText('Versi 1.1.0 tersedia');
  fireEvent.click(screen.getByText('Nanti'));

  await waitFor(() => expect(screen.queryByText('Versi 1.1.0 tersedia')).toBe(null));
});

test('versi yang lebih baru tetap ditawarkan walau versi sebelumnya dijawab "Nanti"', async () => {
  renderPage();
  await screen.findByText('Versi 1.1.0 tersedia');
  fireEvent.click(screen.getByText('Nanti'));
  await waitFor(() => expect(screen.queryByText('Versi 1.1.0 tersedia')).toBe(null));

  latest.mockResolvedValue({ data: release({ version_code: 3, version_name: '1.2.0' }) });
  renderPage();

  await waitFor(() => expect(screen.getByText('Versi 1.2.0 tersedia')).toBeTruthy());
});

test('menampilkan keadaan kosong saat aplikasi sudah versi terbaru', async () => {
  installedBuild.mockResolvedValue(2);

  renderPage();

  await waitFor(() => expect(latest).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText('Belum ada notifikasi')).toBeTruthy());
});

test('menampilkan keadaan kosong saat server belum punya rilis (404)', async () => {
  latest.mockRejectedValue(new Error('NOT_FOUND'));

  renderPage();

  await waitFor(() => expect(latest).toHaveBeenCalled());
  await waitFor(() => expect(screen.getByText('Belum ada notifikasi')).toBeTruthy());
});
