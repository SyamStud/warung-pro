import { formatAmount } from './amount';
import { renderEscPos } from './escpos';
import { wrapText } from './layout';
import { PAPER_COLUMNS, type ReceiptLine, type ReceiptOptions } from './types';
import type { TransferReceiptData } from '../transfer/types';

/** A short label/value line, wrapped when the value is longer than the paper. */
function field(label: string, value: string, columns: number): ReceiptLine[] {
  const text = value.trim();

  if (!text) return [];

  const prefix = `${label}: `;
  const wrapped = wrapText(`${prefix}${text}`, columns);

  return wrapped.map((line, index) => ({
    kind: 'text' as const,
    text: index === 0 ? line : `  ${line}`,
  }));
}

/** A label on its own line with an indented value, for long account/ref data. */
function block(label: string, value: string, columns: number): ReceiptLine[] {
  const text = value.trim();

  if (!text) return [];

  const lines: ReceiptLine[] = [{ kind: 'text', text: `${label}:` }];

  for (const row of text.split(/\r?\n/)) {
    for (const line of wrapText(row.trim(), columns - 2)) {
      lines.push({ kind: 'text', text: `  ${line}` });
    }
  }

  return lines;
}

function providerLabel(data: TransferReceiptData): string {
  return data.providerKind === 'bank' ? 'Bank' : 'Aplikasi';
}

function destinationAccountLabel(data: TransferReceiptData): string {
  if (data.providerKind === 'ewallet') return 'Akun / No. HP';
  return 'No. Rekening';
}

/**
 * Build the text receipt for a bank or e-wallet transfer proof.
 *
 * The layout mirrors the transfer receipts printed by ATMs: store name on top,
 * date/time, destination, nominal and reference number. Fields that the source
 * app does not print are skipped.
 */
export function buildTransferReceiptLines(
  data: TransferReceiptData,
  options: ReceiptOptions,
): ReceiptLine[] {
  const columns = PAPER_COLUMNS[options.paperWidth];
  const lines: ReceiptLine[] = [];

  const storeName = options.storeName.trim() || 'Warung';
  const storeColumns = Math.max(8, Math.floor(columns / 2));

  for (const line of wrapText(storeName, storeColumns)) {
    lines.push({ kind: 'text', text: line, align: 'center', bold: true, double: true });
  }

  if (options.storeAddress?.trim()) {
    for (const line of wrapText(options.storeAddress.trim(), columns)) {
      lines.push({ kind: 'text', text: line, align: 'center' });
    }
  }

  lines.push({ kind: 'text', text: 'BUKTI TRANSFER', align: 'center', bold: true });
  lines.push({ kind: 'divider' });

  lines.push(...field(providerLabel(data), data.provider, columns));
  lines.push(...field('Tanggal', data.date, columns));
  lines.push(...field('Jam', data.time, columns));
  lines.push(...field('Jenis', data.transactionType, columns));
  lines.push(...field('Status', data.status, columns));

  if (
    data.destinationName ||
    data.destinationBank ||
    data.destinationAccount ||
    data.sourceName ||
    data.sourceAccount ||
    data.paymentMethod
  ) {
    lines.push({ kind: 'divider' });
    lines.push(...field('Tujuan', data.destinationName, columns));
    lines.push(...field('Bank Tujuan', data.destinationBank, columns));
    lines.push(...block(destinationAccountLabel(data), data.destinationAccount, columns));
    lines.push(...field('Pengirim', data.sourceName, columns));
    lines.push(...block('Sumber', data.sourceAccount, columns));
    lines.push(...field('Metode', data.paymentMethod, columns));
  }

  lines.push({ kind: 'divider' });
  lines.push({ kind: 'text', text: 'NOMINAL', align: 'center', bold: true });

  if (data.amount > 0) {
    lines.push({
      kind: 'text',
      text: formatAmount(data.amount),
      align: 'center',
      bold: true,
      double: true,
    });
  }

  if (data.adminFee > 0) {
    lines.push({ kind: 'row', left: 'Biaya Admin', right: formatAmount(data.adminFee) });
  }

  if (data.reference) {
    lines.push({ kind: 'divider' });
    lines.push(...block(data.referenceLabel || 'No. Referensi', data.reference, columns));
  }

  if (data.orderId) {
    lines.push(...block(data.orderLabel || 'ID Order', data.orderId, columns));
  }

  if (options.footer?.trim()) {
    lines.push({ kind: 'divider' });
    for (const line of wrapText(options.footer.trim(), columns)) {
      lines.push({ kind: 'text', text: line, align: 'center' });
    }
  }

  lines.push({ kind: 'feed' });

  return lines;
}

export function buildTransferReceiptBytes(
  data: TransferReceiptData,
  options: ReceiptOptions,
): Uint8Array {
  return renderEscPos(buildTransferReceiptLines(data, options), options);
}
