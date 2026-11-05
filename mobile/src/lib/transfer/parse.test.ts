import { describe, expect, it } from 'vitest';
import { parseAmount, parseTransferDate, parseTransferReceipt, parseTransferTime } from './parse';

const BCA_PROOF = `BCA
Tambah Dana Poket Berhasil
02 Nov 2026 01:38:57
IDR 20,000.00
Poket Tujuan
DARURAT
No. Rekening Poket
Tujuan
888 - 001 - 082 - 6007
- 1401
Sumber Dana
108 - 2** - **14
Nominal
IDR 20,000.00
Jenis Transaksi
Transaksi Poket
No. Referensi
9567120261102013856
15400000010474591`;

const DANA_PROOF = `DANA
27 Apr 2026 • 11:48
ID DANA 0813••••4772
Transaksi berhasil!
Kirim Uang Rp5.000 ke 081907668003
Total Bayar
Rp5.000
Metode Pembayaran
Saldo DANA (SmartPay)
Detail Penerima
Nama
Akun DANA
081907668003
Detail Transaksi
ID Transaksi
202604271012142001010
0166817808388274
ID Order Merchant
1f11667b-92a3-4313-83a
e-aa8d15795ddc`;

const BRI_PROOF = `Transaksi Berhasil
Tanggal 10 May 2023 | 09:09:41 WIB
Nomor Referensi 532499537139
Sumber Dana VINA VEBRIANTI
1859 **** **** 505
Jenis Transaksi Transfer Bank BRI
Bank Tujuan BANK BRI
Nomor Tujuan 5773 0103 3924 532
Nama Tujuan BIO VITO PUTRA TAMA
Nominal Rp600.000
Biaya Admin Rp0
Total Rp600.000`;

describe('parseAmount', () => {
  it('reads the English format used by the BCA app', () => {
    expect(parseAmount('IDR 20,000.00')).toBe(20000);
  });

  it('reads the Indonesian format', () => {
    expect(parseAmount('Rp 1.250.000,00')).toBe(1250000);
  });

  it('reads grouped amounts without decimals', () => {
    expect(parseAmount('20.000')).toBe(20000);
    expect(parseAmount('20,000')).toBe(20000);
  });
});

describe('parseTransferDate', () => {
  it('formats a named month', () => {
    expect(parseTransferDate('02 Nov 2026 01:38:57')).toBe('02/11/2026');
  });

  it('keeps a numeric date', () => {
    expect(parseTransferDate('Transfer 2/11/2026')).toBe('02/11/2026');
  });
});

describe('parseTransferTime', () => {
  it('reads hours, minutes and seconds', () => {
    expect(parseTransferTime('02 Nov 2026 01:38:57')).toBe('01:38:57');
  });

  it('reads a time without seconds', () => {
    expect(parseTransferTime('27 Apr 2026 • 11:48')).toBe('11:48');
  });
});

describe('parseTransferReceipt — BCA', () => {
  it('extracts every field from a BCA pocket top-up proof', () => {
    const data = parseTransferReceipt(BCA_PROOF);

    expect(data.provider).toBe('BCA');
    expect(data.providerKind).toBe('bank');
    expect(data.date).toBe('02/11/2026');
    expect(data.time).toBe('01:38:57');
    expect(data.amount).toBe(20000);
    expect(data.destinationName).toBe('DARURAT');
    expect(data.destinationAccount).toBe('888 - 001 - 082 - 6007 - 1401');
    expect(data.sourceAccount).toBe('108 - 2** - **14');
    expect(data.transactionType).toBe('Transaksi Poket');
    expect(data.reference).toBe('9567120261102013856\n15400000010474591');
    expect(data.referenceLabel).toBe('No. Referensi');
  });
});

describe('parseTransferReceipt — DANA', () => {
  it('reads a DANA send-money proof', () => {
    const data = parseTransferReceipt(DANA_PROOF);

    expect(data.provider).toBe('DANA');
    expect(data.providerKind).toBe('ewallet');
    expect(data.date).toBe('27/04/2026');
    expect(data.time).toBe('11:48');
    expect(data.amount).toBe(5000);
    expect(data.status).toBe('Berhasil');
    expect(data.transactionType).toBe('Kirim Uang');
    expect(data.destinationAccount).toBe('081907668003');
    expect(data.sourceAccount).toBe('0813••••4772');
    expect(data.paymentMethod).toBe('Saldo DANA (SmartPay)');
    expect(data.reference).toBe('202604271012142001010\n0166817808388274');
    expect(data.referenceLabel).toBe('ID Transaksi');
    expect(data.orderId).toBe('1f11667b-92a3-4313-83ae-aa8d15795ddc');
    expect(data.orderLabel).toBe('ID Order Merchant');
  });
});

describe('parseTransferReceipt — BRI', () => {
  it('reads a BRI bank transfer proof', () => {
    const data = parseTransferReceipt(BRI_PROOF);

    expect(data.provider).toBe('BRI');
    expect(data.providerKind).toBe('bank');
    expect(data.date).toBe('10/05/2023');
    expect(data.time).toBe('09:09:41');
    expect(data.amount).toBe(600000);
    expect(data.status).toBe('Berhasil');
    expect(data.transactionType).toBe('Transfer Bank BRI');
    expect(data.destinationName).toBe('BIO VITO PUTRA TAMA');
    expect(data.destinationBank).toBe('BANK BRI');
    expect(data.destinationAccount).toBe('5773 0103 3924 532');
    expect(data.sourceName).toBe('VINA VEBRIANTI');
    expect(data.sourceAccount).toBe('1859 **** **** 505');
    expect(data.reference).toBe('532499537139');
    expect(data.adminFee).toBe(0);
  });
});

describe('parseTransferReceipt — fallbacks', () => {
  it('falls back to the first currency amount when labels are missing', () => {
    const data = parseTransferReceipt('Transfer berhasil\nIDR 15,000.00\nRef 123456789012');

    expect(data.amount).toBe(15000);
    expect(data.reference).toBe('123456789012');
  });

  it('returns empty fields for unreadable text', () => {
    const data = parseTransferReceipt('foto buram');

    expect(data.amount).toBe(0);
    expect(data.reference).toBe('');
  });
});
