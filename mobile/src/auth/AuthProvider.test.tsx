import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, test, vi } from 'vitest';
import { ApiError, api } from '../lib/http';
import { queryClient } from '../lib/queryClient';
import { clearSession, profileStore, tokenStore } from '../lib/tokenStore';
import type { User } from '../types';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './useAuth';

vi.mock('../lib/http', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/http')>();
  return {
    ...actual,
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

const demo: User = { id: 1, name: 'Demo', email: 'demo@warung.test' };
const other: User = { id: 2, name: 'Lain', email: 'lain@warung.test' };

/** Renders the bits of the auth context the tests assert on. */
function Probe() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();

  return (
    <div>
      <span data-testid="state">
        {isLoading ? 'loading' : 'ready'}|{isAuthenticated ? 'auth' : 'anon'}|
        {user?.name ?? '-'}
      </span>
      <button onClick={() => void login('demo@warung.test', 'password')}>masuk</button>
      <button onClick={() => void logout()}>keluar</button>
    </div>
  );
}

const state = () => screen.getByTestId('state').textContent;

const renderApp = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

beforeEach(async () => {
  localStorage.clear();
  await clearSession();
  vi.mocked(api.get).mockReset();
  vi.mocked(api.post).mockReset();
});

test('tetap login saat server tidak terjangkau', async () => {
  await tokenStore.set('token-1');
  await profileStore.set(demo);
  vi.mocked(api.get).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'putus'));

  renderApp();

  // Sesi langsung dipakai dari penyimpanan, tanpa menunggu jaringan.
  await waitFor(() => expect(state()).toBe('ready|auth|Demo'));
  // Token tidak dihapus — membuka app tanpa koneksi tidak memaksa login ulang.
  await expect(tokenStore.get()).resolves.toBe('token-1');
  await expect(profileStore.get()).resolves.toEqual(demo);
});

test('tetap login saat server mengembalikan galat 500', async () => {
  await tokenStore.set('token-1');
  await profileStore.set(demo);
  vi.mocked(api.get).mockRejectedValue(new ApiError(500, 'SERVER_ERROR', 'duh'));

  renderApp();

  await waitFor(() => expect(state()).toBe('ready|auth|Demo'));
  await expect(tokenStore.get()).resolves.toBe('token-1');
});

test('keluar saat server menolak token (401)', async () => {
  await tokenStore.set('token-1');
  await profileStore.set(demo);
  vi.mocked(api.get).mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'kadaluarsa'));

  renderApp();

  await waitFor(() => expect(state()).toBe('ready|anon|-'));
  await expect(tokenStore.get()).resolves.toBeNull();
  await expect(profileStore.get()).resolves.toBeNull();
});

test('memakai profil terbaru dari /me', async () => {
  await tokenStore.set('token-1');
  await profileStore.set(demo);
  vi.mocked(api.get).mockResolvedValue({ data: other });

  renderApp();

  await waitFor(() => expect(state()).toBe('ready|auth|Lain'));
  await expect(profileStore.get()).resolves.toEqual(other);
});

test('tanpa token langsung anonim dan tidak memanggil /me', async () => {
  renderApp();

  await waitFor(() => expect(state()).toBe('ready|anon|-'));
  expect(api.get).not.toHaveBeenCalled();
});

test('login menyimpan token dan profil', async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { user: demo, token: 'token-9' } });

  renderApp();
  await waitFor(() => expect(state()).toBe('ready|anon|-'));

  fireEvent.click(screen.getByText('masuk'));

  await waitFor(() => expect(state()).toBe('ready|auth|Demo'));
  await expect(tokenStore.get()).resolves.toBe('token-9');
  await expect(profileStore.get()).resolves.toEqual(demo);
});

test('logout membersihkan sesi walau server tidak terjangkau', async () => {
  await tokenStore.set('token-1');
  await profileStore.set(demo);
  queryClient.setQueryData(['products', 'list', {}], { data: [demo] });
  vi.mocked(api.get).mockResolvedValue({ data: demo });
  vi.mocked(api.post).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'putus'));

  renderApp();
  await waitFor(() => expect(state()).toBe('ready|auth|Demo'));

  fireEvent.click(screen.getByText('keluar'));

  await waitFor(() => expect(state()).toBe('ready|anon|-'));
  await expect(tokenStore.get()).resolves.toBeNull();
  // Cached rows belong to the account that left — the next person to sign in on
  // this phone must not see them.
  expect(queryClient.getQueryData(['products', 'list', {}])).toBeUndefined();
});
