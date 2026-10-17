import type { Cell, ImportField } from './types';

/** Highest price the server accepts, in rupiah. Mirrors ProductImporter. */
export const MAX_PRICE = 999_999_999_999;

/** A cell as trimmed text; numbers keep every digit they came with. */
export function text(cell: Cell | undefined): string | null {
  if (typeof cell === 'string') {
    const trimmed = cell.trim();

    return trimmed === '' ? null : trimmed;
  }

  if (typeof cell === 'number') return Number.isFinite(cell) ? String(cell) : null;
  if (cell instanceof Date) return cell.toISOString();

  return null;
}

/**
 * Reads a price cell in any of the shapes a spreadsheet produces.
 *
 * Rupiah has no cents, so a separator followed by exactly two digits is read as
 * a decimal point ("12.500,50" → 12501) and every other separator as thousands
 * ("5.000" → 5000, "1,234" → 1234). Text, blank cells and a lone dash give
 * null, and the row is reported instead of guessing.
 */
export function parsePrice(cell: Cell | undefined): number | null {
  if (typeof cell === 'number') {
    return Number.isFinite(cell) && cell >= 0 && cell <= MAX_PRICE ? Math.round(cell) : null;
  }

  if (typeof cell !== 'string') return null;

  // Drop "Rp", spaces and anything else that is not part of the number.
  const cleaned = cell.replace(/[^\d.,]/g, '');
  if (!/\d/.test(cleaned)) return null;

  const lastSeparator = Math.max(cleaned.lastIndexOf('.'), cleaned.lastIndexOf(','));
  const decimals = cleaned.length - lastSeparator - 1;

  const normalized =
    lastSeparator >= 0 && decimals === 2
      ? `${cleaned.slice(0, lastSeparator).replace(/[.,]/g, '')}.${cleaned.slice(lastSeparator + 1)}`
      : cleaned.replace(/[.,]/g, '');

  const value = Number(normalized);

  return Number.isFinite(value) && value >= 0 && value <= MAX_PRICE ? Math.round(value) : null;
}

/** Header names accepted for each field, in their normalised form. */
const ALIASES: Record<ImportField, string[]> = {
  name: ['nama', 'namaproduk', 'namabarang', 'produk', 'barang', 'name', 'product'],
  sku: ['sku', 'kode', 'kodeproduk', 'kodebarang', 'barcode', 'kodebarcode'],
  unit: ['satuan', 'unit', 'uom'],
  selling_price: ['harga', 'hargajual', 'hargaproduk', 'price', 'sellingprice'],
  category: ['kategori', 'category', 'grup', 'group'],
  notes: ['catatan', 'keterangan', 'notes', 'note', 'deskripsi'],
};

/** Lowercases a header and drops everything that is not a letter or digit. */
export function normalizeHeader(value: Cell | undefined): string {
  return (text(value) ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** The field each column of a header row fills; unknown columns give null. */
export function mapColumns(header: Cell[]): (ImportField | null)[] {
  const fields = Object.keys(ALIASES) as ImportField[];

  return header.map((cell) => {
    const normalized = normalizeHeader(cell);
    if (normalized === '') return null;

    return fields.find((field) => ALIASES[field].includes(normalized)) ?? null;
  });
}
