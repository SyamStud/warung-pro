import { expect, test } from 'vitest';
import { formatAmount } from './amount';
import { buildReceiptBytes } from './escpos';
import { buildReceiptText } from './text';
import { createSampleTransaction } from './sample';
import { PAPER_COLUMNS, type ReceiptOptions } from './types';
import type { Transaction } from '../../types';

const ESC = String.fromCharCode(0x1b);
const GS = String.fromCharCode(0x1d);

const baseOptions: ReceiptOptions = {
  paperWidth: '58',
  storeName: 'Warung Bu Siti',
  storeAddress: 'Jl. Merdeka No. 10, Bandung',
  footer: 'Terima kasih telah berbelanja',
};

function asString(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join('');
}

function linesOf(text: string): string[] {
  return text.split('\n');
}

test('paper widths map to 32 and 48 columns', () => {
  expect(PAPER_COLUMNS['58']).toBe(32);
  expect(PAPER_COLUMNS['80']).toBe(48);
});

test('58mm preview never exceeds 32 characters per line', () => {
  const text = buildReceiptText(createSampleTransaction(), baseOptions);

  for (const line of linesOf(text)) {
    expect(line.length).toBeLessThanOrEqual(32);
  }
});

test('80mm preview never exceeds 48 characters per line', () => {
  const text = buildReceiptText(createSampleTransaction(), { ...baseOptions, paperWidth: '80' });

  for (const line of linesOf(text)) {
    expect(line.length).toBeLessThanOrEqual(48);
  }

  // The wider paper really is used: the divider stretches to 48 columns.
  expect(linesOf(text).some((line) => line === '-'.repeat(48))).toBe(true);
});

test('a long product name wraps instead of overflowing', () => {
  const sample = createSampleTransaction();
  const transaction: Transaction = {
    ...sample,
    items: [
      {
        ...sample.items![0],
        product_name: 'Minyak Goreng Sawit Premium Kemasan Ekonomis 2 Liter',
      },
    ],
  };

  const lines = linesOf(buildReceiptText(transaction, baseOptions));

  expect(lines.some((line) => line.includes('Minyak Goreng'))).toBe(true);
  expect(lines.some((line) => line.includes('Ekonomis'))).toBe(true);
  for (const line of lines) {
    expect(line.length).toBeLessThanOrEqual(32);
  }
});

test('summary rows right-align the amount to the paper width', () => {
  const lines = linesOf(buildReceiptText(createSampleTransaction(), baseOptions));

  const totalLine = lines.find((line) => line.startsWith('TOTAL'));
  expect(totalLine).toBeDefined();
  expect(totalLine!.length).toBe(32);
  expect(totalLine!.endsWith('Rp 11.000')).toBe(true);

  const subtotalLine = lines.find((line) => line.startsWith('Subtotal'));
  expect(subtotalLine!.endsWith('Rp 12.000')).toBe(true);
});

test('escpos output initialises, centres the store name, and cuts', () => {
  const bytes = buildReceiptBytes(createSampleTransaction(), baseOptions);
  const raw = asString(bytes);

  expect(bytes).toBeInstanceOf(Uint8Array);
  // ESC @ (initialise) first.
  expect(Array.from(bytes.slice(0, 2))).toEqual([0x1b, 0x40]);
  // Store name is printed double-size and centred.
  expect(raw).toContain(`${GS}${String.fromCharCode(0x21)}${String.fromCharCode(0x11)}`);
  expect(raw).toContain(`${ESC}${String.fromCharCode(0x61)}${String.fromCharCode(0x01)}`);
  expect(raw).toContain('Warung Bu Siti');
  expect(raw).toContain('Rp 11.000');
  // Ends with a partial cut.
  expect(Array.from(bytes.slice(-4))).toEqual([0x1d, 0x56, 0x42, 0x00]);
});

test('escpos replaces non-ASCII characters with "?"', () => {
  const bytes = buildReceiptBytes(createSampleTransaction(), {
    ...baseOptions,
    storeName: 'Warung “Kopi”',
  });

  const raw = asString(bytes);
  expect(raw).toContain('Warung ?Kopi?');
});

test('formatAmount groups thousands and stays ASCII', () => {
  expect(formatAmount(4000)).toBe('Rp 4.000');
  expect(formatAmount(1234567)).toBe('Rp 1.234.567');
  expect(formatAmount(-500)).toBe('-Rp 500');
  expect(formatAmount(0)).toBe('Rp 0');
});
