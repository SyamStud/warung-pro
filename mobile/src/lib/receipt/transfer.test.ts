import { describe, expect, it } from 'vitest';
import { renderText } from './text';
import { PAPER_COLUMNS, type ReceiptOptions } from './types';
import { buildTransferReceiptLines } from './transfer';
import type { TransferReceiptData } from '../transfer/types';

const options: ReceiptOptions = {
  paperWidth: '58',
  storeName: 'Warung Bu Siti',
  storeAddress: 'Jl. Melati 12',
  footer: 'Terima kasih',
};

const data: TransferReceiptData = {
  provider: 'BCA',
  providerKind: 'bank',
  date: '02/11/2026',
  time: '01:38:57',
  amount: 20000,
  status: 'Berhasil',
  transactionType: 'Transaksi Poket',
  destinationName: 'DARURAT',
  destinationBank: '',
  destinationAccount: '888 - 001 - 082 - 6007 - 1401',
  sourceName: '',
  sourceAccount: '108 - 2** - **14',
  paymentMethod: '',
  adminFee: 0,
  reference: '9567120261102013856\n15400000010474591',
  referenceLabel: 'No. Referensi',
  orderId: '',
  orderLabel: '',
};

function textOf(receipt: TransferReceiptData): string[] {
  return renderText(buildTransferReceiptLines(receipt, options), options).split('\n');
}

describe('buildTransferReceiptLines', () => {
  it('prints the store name, title and every field', () => {
    const lines = textOf(data);
    const raw = lines.join('\n');

    expect(lines[0]).toContain('Warung Bu Siti');
    expect(raw).toContain('BUKTI TRANSFER');
    expect(raw).toContain('Bank: BCA');
    expect(raw).toContain('Tanggal: 02/11/2026');
    expect(raw).toContain('Jam: 01:38:57');
    expect(raw).toContain('Status: Berhasil');
    expect(raw).toContain('Tujuan: DARURAT');
    expect(raw).toContain('NOMINAL');
    expect(raw).toContain('Rp 20.000');
    expect(raw).toContain('9567120261102013856');
    expect(raw).toContain('Terima kasih');
  });

  it('uses wallet wording for e-wallets and prints the payment method', () => {
    const raw = textOf({
      ...data,
      provider: 'DANA',
      providerKind: 'ewallet',
      destinationAccount: '081907668003',
      paymentMethod: 'Saldo DANA (SmartPay)',
      referenceLabel: 'ID Transaksi',
      status: 'Berhasil',
    }).join('\n');

    expect(raw).toContain('Aplikasi: DANA');
    expect(raw).toContain('Akun / No. HP:');
    expect(raw).toContain('Metode: Saldo DANA (SmartPay)');
    expect(raw).toContain('ID Transaksi:');
  });

  it('never exceeds the paper width', () => {
    const columns = PAPER_COLUMNS[options.paperWidth];

    for (const line of textOf(data)) {
      expect(line.length).toBeLessThanOrEqual(columns);
    }
  });

  it('wraps a very long account number instead of cutting it off', () => {
    const raw = textOf({
      ...data,
      destinationAccount: '888 - 001 - 082 - 6007 - 1401 - 9999 - 0000',
    }).join('\n');

    expect(raw).toContain('888 - 001 - 082 - 6007 - 1401');
    expect(raw).toContain('9999 - 0000');
  });

  it('skips empty optional fields', () => {
    const raw = textOf({
      ...data,
      provider: '',
      destinationName: '',
      destinationAccount: '',
      sourceAccount: '',
      reference: '',
      status: '',
    }).join('\n');

    expect(raw).not.toContain('Bank:');
    expect(raw).not.toContain('Tujuan:');
    expect(raw).not.toContain('No. Referensi');
    expect(raw).not.toContain('NOMINAL\n\n');
  });

  it('prints an admin fee only when it is greater than zero', () => {
    expect(textOf(data).join('\n')).not.toContain('Biaya Admin');

    expect(textOf({ ...data, adminFee: 2500 }).join('\n')).toContain('Biaya Admin');
  });
});
