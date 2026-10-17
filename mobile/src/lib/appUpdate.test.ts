import { Preferences } from '@capacitor/preferences';
import { beforeEach, expect, test } from 'vitest';
import { isUpdateAvailable, readDismissedVersion, readSeenVersion, rememberDismissedVersion, rememberSeenVersion } from './appUpdate';
import type { AppRelease } from '../types';

const release = (versionCode: number): AppRelease => ({
  version_code: versionCode,
  version_name: `1.${versionCode}.0`,
  notes: null,
  size_bytes: 1_000_000,
  sha256: 'x',
  published_at: null,
  download_url: `http://host/api/v1/app/release/download?version_code=${versionCode}`,
});

beforeEach(() => {
  localStorage.clear();
});

test('menawarkan pembaruan hanya saat versi server lebih baru', () => {
  expect(isUpdateAvailable(1, release(2))).toBe(true);
  expect(isUpdateAvailable(2, release(2))).toBe(false);
  expect(isUpdateAvailable(3, release(2))).toBe(false);
});

test('tidak menawarkan apa pun saat versi terpasang tidak diketahui', () => {
  expect(isUpdateAvailable(null, release(2))).toBe(false);
  expect(isUpdateAvailable(1, null)).toBe(false);
});

test('mengingat versi yang dijawab "Nanti"', async () => {
  await expect(readDismissedVersion()).resolves.toBe(null);

  await rememberDismissedVersion(2);

  await expect(readDismissedVersion()).resolves.toBe(2);
});

test('nilai tersimpan yang bukan angka dianggap belum pernah ditutup', async () => {
  await Preferences.set({ key: 'warung:update-dismissed', value: 'entah' });

  await expect(readDismissedVersion()).resolves.toBe(null);
});

test('mengingat versi yang sudah dibuka di Notifikasi', async () => {
  await expect(readSeenVersion()).resolves.toBe(null);

  await rememberSeenVersion(4);

  await expect(readSeenVersion()).resolves.toBe(4);
});

test('"sudah dibaca" dan "Nanti" disimpan terpisah', async () => {
  await rememberSeenVersion(4);
  await rememberDismissedVersion(4);

  await Preferences.remove({ key: 'warung:update-dismissed' });

  // Membuang jawaban "Nanti" tidak menghidupkan lagi titik di lonceng.
  await expect(readDismissedVersion()).resolves.toBe(null);
  await expect(readSeenVersion()).resolves.toBe(4);
});
