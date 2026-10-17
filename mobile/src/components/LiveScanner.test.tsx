import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { ScannerError } from '../services/scanner';
import LiveScanner from './LiveScanner';

const stopTrack = vi.fn();
const applyConstraints = vi.fn(async () => undefined);
const ensureCameraPermission = vi.fn<() => Promise<void>>();
const playScanBeep = vi.fn();

/** What the mocked decoder answers on each attempt. */
let nextDecoded: () => string | null = () => '8991234567890';

vi.mock('../lib/beep', () => ({
  playScanBeep: () => playScanBeep(),
  primeBeep: () => () => undefined,
}));

vi.mock('../services/scanner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/scanner')>();
  return {
    ...actual,
    scannerService: {
      ...actual.scannerService,
      ensureCameraPermission: () => ensureCameraPermission(),
    },
  };
});

vi.mock('@zxing/library', () => ({
  DecodeHintType: { POSSIBLE_FORMATS: 'POSSIBLE_FORMATS', TRY_HARDER: 'TRY_HARDER' },
  BarcodeFormat: {
    EAN_13: 'ean_13',
    EAN_8: 'ean_8',
    UPC_A: 'upc_a',
    UPC_E: 'upc_e',
    CODE_128: 'code_128',
  },
  BinaryBitmap: class {},
  HybridBinarizer: class {},
  HTMLCanvasElementLuminanceSource: class {},
  MultiFormatReader: class {
    setHints() {
      /* hints diterima; perilaku diuji lewat confirmCandidate */
    }

    decodeWithState() {
      const value = nextDecoded();
      if (!value) throw new Error('NotFoundException');
      return { getText: () => value };
    }
  },
}));

function fakeStream() {
  return {
    getTracks: () => [{ stop: stopTrack, applyConstraints, getCapabilities: () => ({}) }],
    getVideoTracks: () => [{ stop: stopTrack, applyConstraints, getCapabilities: () => ({}) }],
  } as unknown as MediaStream;
}

function withCamera(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
}

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

beforeEach(() => {
  vi.clearAllMocks();
  nextDecoded = () => '8991234567890';
  ensureCameraPermission.mockResolvedValue(undefined);
  withCamera(async () => fakeStream());

  // jsdom has no real canvas/media stack: give the loop just enough to run.
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({
      drawImage: () => undefined,
      getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    }),
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
    configurable: true,
    get: () => 1280,
  });
  Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
    configurable: true,
    get: () => 720,
  });
  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: Element) {
      const className = typeof this.className === 'string' ? this.className : '';
      if (className.includes('viewfinder__video')) return rect(0, 0, 400, 300);
      if (className.includes('viewfinder__frame')) return rect(140, 120, 120, 120);
      return rect(0, 0, 0, 0);
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

test('mempercayai kode setelah dua frame sepakat, lalu berbunyi sekali', async () => {
  const onDetected = vi.fn();

  render(<LiveScanner active onToggle={() => {}} onDetected={onDetected} />);

  await waitFor(() => expect(onDetected).toHaveBeenCalledWith('8991234567890'));
  expect(playScanBeep).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Pindai otomatis')).toBeTruthy();

  // Kode yang sama tidak dilaporkan berulang-ulang.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 300));
  });
  expect(onDetected).toHaveBeenCalledTimes(1);
});

test('satu frame saja tidak dipercaya — ini yang bikin salah baca', async () => {
  let attempt = 0;
  nextDecoded = () => `89912345678${String(attempt++).padStart(2, '0')}`;
  const onDetected = vi.fn();

  render(<LiveScanner active onToggle={() => {}} onDetected={onDetected} />);

  await waitFor(() => expect(screen.getByText('Pindai otomatis')).toBeTruthy());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 700));
  });

  expect(onDetected).not.toHaveBeenCalled();
  expect(playScanBeep).not.toHaveBeenCalled();
});

test('"Pindai ulang" (rearmKey) membuat kode yang sama bisa dipindai lagi tanpa restart kamera', async () => {
  const onDetected = vi.fn();
  const { rerender } = render(
    <LiveScanner active rearmKey={0} onToggle={() => {}} onDetected={onDetected} />,
  );

  await waitFor(() => expect(onDetected).toHaveBeenCalledTimes(1));

  rerender(<LiveScanner active rearmKey={1} onToggle={() => {}} onDetected={onDetected} />);

  await waitFor(() => expect(onDetected).toHaveBeenCalledTimes(2));
  // Kamera tidak dinyalakan ulang: cukup sekali sejak awal.
  expect(ensureCameraPermission).toHaveBeenCalledTimes(1);
});

test('melepas kamera saat halaman ditinggalkan', async () => {
  const { unmount } = render(<LiveScanner active onToggle={() => {}} onDetected={() => {}} />);

  await waitFor(() => expect(screen.getByText('Pindai otomatis')).toBeTruthy());
  unmount();

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

test('fokus kontinu diminta supaya barcode tidak buram', async () => {
  render(<LiveScanner active onToggle={() => {}} onDetected={() => {}} />);

  await waitFor(() => expect(applyConstraints).toHaveBeenCalled());
  expect(applyConstraints).toHaveBeenCalledWith({ advanced: [{ focusMode: 'continuous' }] });
});
