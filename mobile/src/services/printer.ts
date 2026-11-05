import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import {
  ThermalPrinter,
  bytesToBase64,
  type PrintTarget,
  type PrinterDevice,
} from '@devlas/capacitor-thermal-printer';
import { buildReceiptBytes, buildReceiptText, createSampleTransaction } from '../lib/receipt';
import { buildTransferReceiptBytes, buildTransferReceiptLines } from '../lib/receipt/transfer';
import { renderText } from '../lib/receipt/text';
import type { TransferReceiptData } from '../lib/transfer/types';
import type { PaperWidth, ReceiptOptions } from '../lib/receipt';
import type { Transaction } from '../types';

/** Connection kind. Bluetooth is SPP (classic), which thermal printers use. */
export type PrinterTransportKind = 'bluetooth' | 'usb' | 'tcp';

export const TRANSPORT_LABELS: Record<PrinterTransportKind, string> = {
  bluetooth: 'Bluetooth',
  usb: 'USB (OTG)',
  tcp: 'WiFi / LAN (TCP)',
};

/** A configured, ready-to-use printer destination. */
export interface SavedPrinter {
  transport: PrinterTransportKind;
  label: string;
  /** Bluetooth MAC address. */
  address?: string;
  /** USB vendor/product — more stable than the session deviceId. */
  vendorId?: number;
  productId?: number;
  /** TCP host and raw port (JetDirect). */
  host?: string;
  port?: number;
}

export interface PrinterSettings {
  paperWidth: PaperWidth;
  storeName: string;
  storeAddress: string;
  footer: string;
  printer: SavedPrinter | null;
  /**
   * What a picture shared from another app becomes: the screenshot itself, or
   * a text receipt read from it (bank transfer proofs).
   */
  shareMode: ShareReceiptMode;
}

export type ShareReceiptMode = 'image' | 'transfer';

export const DEFAULT_PRINTER_SETTINGS: PrinterSettings = {
  paperWidth: '58',
  storeName: 'Warung',
  storeAddress: '',
  footer: 'Terima kasih telah berbelanja',
  printer: null,
  shareMode: 'image',
};

const SETTINGS_KEY = 'printer.settings.v1';

const ERROR_MESSAGES: Record<string, string> = {
  unavailable: 'Jenis koneksi ini tidak tersedia di perangkat.',
  not_found: 'Printer tidak ditemukan. Pastikan printer menyala dan sudah dipasangkan.',
  permission_denied: 'Izin akses printer ditolak.',
  connect_failed: 'Gagal terhubung ke printer.',
  write_failed: 'Gagal mengirim data ke printer.',
  invalid_transport: 'Jenis koneksi tidak didukung.',
  invalid_data: 'Data struk tidak valid.',
};

export class PrinterError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'PrinterError';
  }
}

function toPrinterError(error: unknown): PrinterError {
  const code = (error as { code?: string } | null)?.code ?? 'write_failed';
  return new PrinterError(code, ERROR_MESSAGES[code] ?? 'Gagal mencetak struk.');
}

/** Native printing is Android-only; the web build previews the receipt instead. */
export function isPrintingSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export function toReceiptOptions(settings: PrinterSettings): ReceiptOptions {
  return {
    paperWidth: settings.paperWidth,
    storeName: settings.storeName,
    storeAddress: settings.storeAddress,
    footer: settings.footer,
  };
}

export function toPrintTarget(printer: SavedPrinter): PrintTarget {
  switch (printer.transport) {
    case 'usb':
      return { transport: 'usb', vendorId: printer.vendorId, productId: printer.productId };
    case 'tcp':
      return { transport: 'tcp', host: printer.host ?? '', port: printer.port ?? 9100 };
    case 'bluetooth':
    default:
      return { transport: 'bluetooth', address: printer.address ?? '' };
  }
}

export function savedPrinterFromDevice(device: PrinterDevice): SavedPrinter {
  return {
    transport: device.transport === 'usb' ? 'usb' : 'bluetooth',
    label: device.name ?? device.address ?? 'Printer',
    address: device.address,
    vendorId: device.vendorId,
    productId: device.productId,
  };
}

export async function loadPrinterSettings(): Promise<PrinterSettings> {
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY });
    if (!value) return DEFAULT_PRINTER_SETTINGS;
    return { ...DEFAULT_PRINTER_SETTINGS, ...(JSON.parse(value) as Partial<PrinterSettings>) };
  } catch {
    return DEFAULT_PRINTER_SETTINGS;
  }
}

export async function savePrinterSettings(settings: PrinterSettings): Promise<void> {
  await Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(settings) });
}

export async function listPrintDevices(
  transport: 'usb' | 'bluetooth',
): Promise<PrinterDevice[]> {
  if (!isPrintingSupported()) return [];

  try {
    const { devices } = await ThermalPrinter.list({ transport });
    return devices;
  } catch (error) {
    throw toPrinterError(error);
  }
}

export function previewReceipt(transaction: Transaction, settings: PrinterSettings): string {
  return buildReceiptText(transaction, toReceiptOptions(settings));
}

/** Plain-text preview of a transfer proof, using the exact printer layout. */
export function previewTransferReceipt(
  data: TransferReceiptData,
  settings: PrinterSettings,
): string {
  return renderText(
    buildTransferReceiptLines(data, toReceiptOptions(settings)),
    toReceiptOptions(settings),
  );
}

/**
 * Sends an already-encoded ESC/POS stream to the configured printer.
 *
 * Shared by receipts and images: the transport does not care what the bytes
 * mean, only that something encoded them.
 */
export async function printBytes(bytes: Uint8Array, settings: PrinterSettings): Promise<void> {
  if (!settings.printer) {
    throw new PrinterError('not_found', 'Belum ada printer yang dipilih.');
  }

  if (!isPrintingSupported()) {
    throw new PrinterError('unavailable', ERROR_MESSAGES.unavailable);
  }

  const target = toPrintTarget(settings.printer);

  // Bluetooth/USB ask for permission; TCP returns granted. Failures here are
  // reported by print() with a more specific code, so we don't block on them.
  try {
    await ThermalPrinter.requestPermission(target);
  } catch {
    // ignore — print() below will surface a usable error
  }

  try {
    await ThermalPrinter.print({ ...target, data: bytesToBase64(bytes) });
  } catch (error) {
    throw toPrinterError(error);
  }
}

export async function printTransaction(
  transaction: Transaction,
  settings: PrinterSettings,
): Promise<void> {
  const bytes = buildReceiptBytes(transaction, toReceiptOptions(settings));
  await printBytes(bytes, settings);
}

/** Prints a transfer proof as a normal text receipt. */
export async function printTransferReceipt(
  data: TransferReceiptData,
  settings: PrinterSettings,
): Promise<void> {
  await printBytes(buildTransferReceiptBytes(data, toReceiptOptions(settings)), settings);
}

/** Print a sample receipt to confirm the printer works. */
export async function testPrint(settings: PrinterSettings): Promise<void> {
  await printTransaction(createSampleTransaction(), settings);
}
