import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ScannerError } from '../services/scanner';
import LiveScanner from './LiveScanner';

const stopTrack = vi.fn();
const ensureCameraPermission = vi.fn<() => Promise<void>>();
const decodeFromStream = vi.fn();
const stopContinuousDecode = vi.fn();
const playScanBeep = vi.fn();

vi.mock('../lib/beep', () => ({
  playScanBeep: () => playScanBeep(),
  primeBeep: () => () => undefined,
}));

vi.mock('../services/scanner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/scanner')>();
  return {
    ...actual,
    scannerService: { ...actual.scannerService, ensureCameraPermission: () => ensureCameraPermission() },
  };
});

vi.mock('@zxing/library', () => ({
  DecodeHintType: { POSSIBLE_FORMATS: 'POSSIBLE_FORMATS' },
  BarcodeFormat: { EAN_13: 'ean_13' },
  BrowserMultiFormatReader: class {
    decodeFromStream = decodeFromStream;
    stopContinuousDecode = stopContinuousDecode;
  },
}));

function fakeStream() {
  return { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
}

function withCamera(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  ensureCameraPermission.mockResolvedValue(undefined);
  // zxing reports a barcode on the first frame.
  decodeFromStream.mockImplementation(async (_stream, _video, callback) => {
    callback({ getText: () => '8991234567890' });
  });
  withCamera(async () => fakeStream());
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

test('menyalakan kamera dan mengirim hasil pindai pertama', async () => {
  const onDetected = vi.fn();

  render(<LiveScanner active onToggle={() => {}} onDetected={onDetected} />);

  await waitFor(() => expect(onDetected).toHaveBeenCalledWith('8991234567890'));
  expect(playScanBeep).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Pindai otomatis')).toBeTruthy();
  expect(
    screen.getByText(/Arahkan barcode ke dalam bingkai/i),
  ).toBeTruthy();
  // Hanya sekali walau callback dipanggil berulang.
  onDetected.mockClear();
  expect(onDetected).not.toHaveBeenCalled();
});

test('melepas kamera saat halaman ditinggalkan', async () => {
  const { unmount } = render(<LiveScanner active onToggle={() => {}} onDetected={() => {}} />);

  // Tunggu sampai loop pemindaian benar-benar berjalan.
  await waitFor(() => expect(screen.getByText('Pindai otomatis')).toBeTruthy());
  unmount();

  expect(stopContinuousDecode).toHaveBeenCalled();
  expect(stopTrack).toHaveBeenCalled();
});

test('izin kamera ditolak → pesan jelas, kamera tidak dibuka', async () => {
  const getUserMedia = vi.fn();
  withCamera(getUserMedia);
  ensureCameraPermission.mockRejectedValue(
    new ScannerError('permission', 'Izin kamera ditolak. Aktifkan izin kamera untuk memindai.'),
  );

  render(<LiveScanner active onToggle={() => {}} onDetected={() => {}} />);

  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/izin kamera ditolak/i));
  expect(getUserMedia).not.toHaveBeenCalled();
  // Petunjuk mengarahkan ke cara kedua: tombol ML Kit.
  expect(screen.getByText(/Pakai tombol Pindai Barcode/i)).toBeTruthy();
});

test('tidak menyalakan kamera saat mode pratinjau dimatikan', async () => {
  const getUserMedia = vi.fn();
  withCamera(getUserMedia);

  render(<LiveScanner active={false} onToggle={() => {}} onDetected={() => {}} />);

  await waitFor(() => expect(screen.getByText('Nyalakan')).toBeTruthy());
  expect(getUserMedia).not.toHaveBeenCalled();
  expect(screen.getByText('Mode pindai')).toBeTruthy();
});

test('"Coba lagi" menyalakan ulang kamera setelah gagal', async () => {
  let attempt = 0;
  withCamera(async () => {
    attempt += 1;
    if (attempt === 1) {
      const error = new Error('no camera');
      error.name = 'NotFoundError';
      throw error;
    }
    return fakeStream();
  });
  const onDetected = vi.fn();

  render(<LiveScanner active onToggle={() => {}} onDetected={onDetected} />);

  await waitFor(() => expect(screen.getByText('Coba lagi')).toBeTruthy());
  screen.getByText('Coba lagi').click();

  await waitFor(() => expect(onDetected).toHaveBeenCalledWith('8991234567890'));
  expect(attempt).toBe(2);
});

test('kamera tidak tersedia → tetap ada jalan keluar', async () => {
  withCamera(async () => {
    const error = new Error('no camera');
    error.name = 'NotFoundError';
    throw error;
  });

  render(<LiveScanner active onToggle={() => {}} onDetected={() => {}} />);

  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/kamera tidak dapat dibuka/i));
  expect(screen.getByText(/Pakai tombol Pindai Barcode/i)).toBeTruthy();
});
