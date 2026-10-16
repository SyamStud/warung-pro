/** Paper widths the receipt layout supports. */
export type PaperWidth = '58' | '80';

/**
 * Character columns per line at Font A, the layout used by virtually every
 * 58mm/80mm ESC/POS printer: 58mm -> 32 columns, 80mm -> 48 columns.
 */
export const PAPER_COLUMNS: Record<PaperWidth, number> = {
  '58': 32,
  '80': 48,
};

export const PAPER_WIDTHS: PaperWidth[] = ['58', '80'];

export const PAPER_LABELS: Record<PaperWidth, string> = {
  '58': '58 mm (32 kolom)',
  '80': '80 mm (48 kolom)',
};

export interface ReceiptOptions {
  paperWidth: PaperWidth;
  storeName: string;
  storeAddress?: string | null;
  footer?: string | null;
}

export type TextAlign = 'left' | 'center' | 'right';

/**
 * A receipt is built as a small layout model so it can be rendered either to
 * ESC/POS bytes (printer) or to plain text (preview) with identical wrapping.
 */
export type ReceiptLine =
  | { kind: 'text'; text: string; align?: TextAlign; bold?: boolean; double?: boolean }
  | { kind: 'row'; left: string; right: string; bold?: boolean }
  | { kind: 'divider' }
  | { kind: 'feed' };
