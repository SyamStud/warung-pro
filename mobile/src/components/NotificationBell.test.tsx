import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, test, vi } from 'vitest';
import NotificationBell from './NotificationBell';
import { rememberSeenVersion } from '../lib/appUpdate';
import type { AppRelease } from '../types';

const latest = vi.fn<() => Promise<{ data: AppRelease }>>();
const installedBuild = vi.fn<() => Promise<number | null>>();

vi.mock('../api/releases', () => ({
  releasesApi: { latest: () => latest() },
}));

vi.mock('../lib/appVersion', () => ({
  installedBuild: () => installedBuild(),
}));

const release: AppRelease = {
  version_code: 2,
  version_name: '1.1.0',
  notes: null,
  size_bytes: 1_000_000,
  sha256: 'abc',
  published_at: null,
  download_url: 'http://host/api/v1/app/release/download?version_code=2',
};

function renderBell(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  installedBuild.mockResolvedValue(1);
  latest.mockResolvedValue({ data: release });
});

test('menandai lonceng saat ada kabar yang belum dibuka', async () => {
  renderBell();

  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Notifikasi, 1 baru' })).toBeTruthy(),
  );
});

test('titik di lonceng hilang setelah kabarnya pernah dibuka', async () => {
  await rememberSeenVersion(2);

  renderBell();

  await waitFor(() => expect(screen.getByRole('button', { name: 'Notifikasi' })).toBeTruthy());
});

test('tanpa kabar, lonceng tetap ada tanpa titik', async () => {
  installedBuild.mockResolvedValue(2);

  renderBell();

  await waitFor(() => expect(latest).toHaveBeenCalled());
  expect(screen.getByRole('button', { name: 'Notifikasi' })).toBeTruthy();
});
