import type { Transaction } from '../../types';
import { paymentMethodLabel } from '../../types';
import { formatDateTime } from '../format';
import { formatAmount } from './amount';
import { PAPER_COLUMNS, type ReceiptLine, type ReceiptOptions } from './types';

const DIVIDER = '-';

/** Wrap text to at most `columns` characters, hard-breaking long words. */
export function wrapText(text: string, columns: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (current === '') {
      current = word;
    } else if (`${current} ${word}`.length <= columns) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }

    while (current.length > columns) {
      lines.push(current.slice(0, columns));
      current = current.slice(columns);
    }
  }

  if (current !== '') lines.push(current);

  return lines.length > 0 ? lines : [''];
}

/** Left label and right value padded to exactly `columns` characters. */
export function padRow(left: string, right: string, columns: number): string {
  const available = columns - right.length - 1;
  const leftText = left.length > available ? left.slice(0, Math.max(available, 0)) : left;
  const padding = Math.max(1, columns - leftText.length - right.length);

  return leftText + ' '.repeat(padding) + right;
}

/**
 * Build the receipt layout for a transaction.
 *
 * All content is derived from the stored transaction snapshot, so a receipt can
 * be reprinted at any time and still match the original sale.
 */
export function buildReceiptLines(transaction: Transaction, options: ReceiptOptions): ReceiptLine[] {
  const columns = PAPER_COLUMNS[options.paperWidth];
  const lines: ReceiptLine[] = [];

  const storeName = options.storeName.trim() || 'Warung';
  // A double-width line only fits half as many characters.
  const storeColumns = Math.max(8, Math.floor(columns / 2));
  for (const line of wrapText(storeName, storeColumns)) {
    lines.push({ kind: 'text', text: line, align: 'center', bold: true, double: true });
  }

  if (options.storeAddress?.trim()) {
    for (const line of wrapText(options.storeAddress.trim(), columns)) {
      lines.push({ kind: 'text', text: line, align: 'center' });
    }
  }

  lines.push({ kind: 'divider' });
  lines.push({ kind: 'text', text: `No: ${transaction.transaction_number}` });
  lines.push({ kind: 'text', text: formatDateTime(transaction.created_at) });
  lines.push({ kind: 'divider' });

  for (const item of transaction.items ?? []) {
    for (const line of wrapText(item.product_name, columns)) {
      lines.push({ kind: 'text', text: line });
    }
    lines.push({
      kind: 'row',
      left: `  ${item.quantity} x ${formatAmount(item.unit_price)}`,
      right: formatAmount(item.line_total),
    });
  }

  lines.push({ kind: 'divider' });
  lines.push({ kind: 'row', left: 'Subtotal', right: formatAmount(transaction.subtotal) });
  if (transaction.discount_amount > 0) {
    lines.push({
      kind: 'row',
      left: 'Diskon',
      right: `-${formatAmount(transaction.discount_amount)}`,
    });
  }
  lines.push({ kind: 'row', left: 'TOTAL', right: formatAmount(transaction.total), bold: true });
  lines.push({
    kind: 'row',
    left: paymentMethodLabel(transaction.payment_method),
    right: formatAmount(transaction.paid_amount),
  });
  lines.push({ kind: 'row', left: 'Kembalian', right: formatAmount(transaction.change_amount) });

  if (options.footer?.trim()) {
    lines.push({ kind: 'divider' });
    for (const line of wrapText(options.footer.trim(), columns)) {
      lines.push({ kind: 'text', text: line, align: 'center' });
    }
  }

  lines.push({ kind: 'feed' });

  return lines;
}

export function dividerLine(columns: number): string {
  return DIVIDER.repeat(columns);
}

export function centerVisual(text: string, columns: number, factor = 1): string {
  const width = text.length * factor;
  if (width >= columns) return text;
  return ' '.repeat(Math.floor((columns - width) / 2)) + text;
}
