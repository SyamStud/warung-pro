import { Capacitor } from '@capacitor/core';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

export interface ScanResult {
  value: string;
  format: string;
}

export type ScannerErrorReason = 'unsupported' | 'permission' | 'cancelled' | 'failed';

/**
 * Error with a machine-readable reason so the UI can react appropriately
 * (e.g. offer manual input when the camera is unavailable).
 */
export class ScannerError extends Error {
  constructor(
    public readonly reason: ScannerErrorReason,
    message: string,
  ) {
    super(message);
    this.name = 'ScannerError';
  }
}

/**
 * Thin wrapper over the native barcode scanner so screens never depend on a
 * specific plugin API directly (PLAN.md §10).
 */
/**
 * Make sure the OS has granted camera access. Both scan paths need it: the
 * native ML Kit UI (`scan`) and the in-app preview (`getUserMedia` inside the
 * WebView, which only works once the app itself holds the permission).
 */
async function ensureCameraPermission(): Promise<void> {
  // In a plain browser the page asks on its own when the preview starts.
  if (!Capacitor.isNativePlatform()) return;

  try {
    const status = await BarcodeScanner.checkPermissions();
    if (status.camera === 'granted') return;

    const requested = await BarcodeScanner.requestPermissions();
    if (requested.camera !== 'granted') {
      throw new ScannerError(
        'permission',
        'Izin kamera ditolak. Aktifkan izin kamera untuk memindai.',
      );
    }
  } catch (error) {
    if (error instanceof ScannerError) throw error;
    throw new ScannerError('permission', 'Tidak dapat mengakses kamera.');
  }
}

export const scannerService = {
  isNativePlatform: (): boolean => Capacitor.isNativePlatform(),

  ensureCameraPermission,

  /**
   * Open the camera scanner and return the first detected barcode, or null if
   * the user closed it without scanning.
   */
  async scan(): Promise<ScanResult | null> {
    if (!Capacitor.isNativePlatform()) {
      throw new ScannerError(
        'unsupported',
        'Pemindaian kamera hanya tersedia di aplikasi Android. Masukkan barcode manual.',
      );
    }

    let supported = false;
    try {
      supported = (await BarcodeScanner.isSupported()).supported;
    } catch {
      supported = false;
    }
    if (!supported) {
      throw new ScannerError('unsupported', 'Perangkat ini tidak mendukung pemindaian barcode.');
    }

    await ensureCameraPermission();

    try {
      const { barcodes } = await BarcodeScanner.scan();
      const first = barcodes[0];
      if (!first) return null;
      return { value: first.rawValue ?? first.displayValue ?? '', format: first.format };
    } catch (error) {
      if (error instanceof ScannerError) throw error;
      throw new ScannerError('failed', 'Pemindaian gagal. Coba lagi.');
    }
  },
};
