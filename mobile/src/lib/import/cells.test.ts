import { expect, test } from 'vitest';
import { MAX_PRICE, mapColumns, normalizeHeader, parsePrice, text } from './cells';

test('membaca harga yang ditulis dengan gaya Indonesia', () => {
  expect(parsePrice('5.000')).toBe(5000);
  expect(parsePrice('Rp 5.000')).toBe(5000);
  expect(parsePrice('Rp12.500')).toBe(12500);
  expect(parsePrice('1.234.567')).toBe(1234567);
  expect(parsePrice('5000')).toBe(5000);
  expect(parsePrice('  4 500 ')).toBe(4500);
});

test('membaca harga yang ditulis dengan gaya Inggris', () => {
  expect(parsePrice('1,234')).toBe(1234);
  expect(parsePrice('1,234.56')).toBe(1235);
});

test('memperlakukan dua angka di belakang pemisah sebagai desimal', () => {
  expect(parsePrice('12.500,50')).toBe(12501);
  expect(parsePrice('1500.00')).toBe(1500);
});

test('harga kosong atau tidak terbaca tidak ditebak', () => {
  expect(parsePrice('')).toBe(null);
  expect(parsePrice('   ')).toBe(null);
  expect(parsePrice('Rp')).toBe(null);
  expect(parsePrice('-')).toBe(null);
  expect(parsePrice('tanya pemilik')).toBe(null);
  expect(parsePrice(null)).toBe(null);
  expect(parsePrice(undefined)).toBe(null);
  expect(parsePrice(true)).toBe(null);
});

test('angka dari Excel dibaca apa adanya', () => {
  expect(parsePrice(5000)).toBe(5000);
  expect(parsePrice(5000.4)).toBe(5000);
  expect(parsePrice(0)).toBe(0);
  expect(parsePrice(-1)).toBe(null);
  expect(parsePrice(MAX_PRICE + 1)).toBe(null);
});

test('teks sel dirapikan dan angka tidak kehilangan digit', () => {
  expect(text('  Indomie  ')).toBe('Indomie');
  expect(text('   ')).toBe(null);
  expect(text(8991234567891)).toBe('8991234567891');
  expect(text(0)).toBe('0');
  expect(text(new Date('2026-10-17T00:00:00Z'))).toBe('2026-10-17T00:00:00.000Z');
  expect(text(true)).toBe(null);
  expect(text(undefined)).toBe(null);
});

test('nama kolom tidak peduli huruf besar, spasi, dan garis bawah', () => {
  expect(normalizeHeader('HARGA_JUAL')).toBe('hargajual');
  expect(normalizeHeader('Nama Produk ')).toBe('namaproduk');
  expect(normalizeHeader(null)).toBe('');
});

test('memetakan kolom berkas ke field katalog', () => {
  expect(
    mapColumns(['Nama Produk', 'Kode', 'Satuan', 'Harga Jual', 'Kategori', 'Catatan']),
  ).toEqual(['name', 'sku', 'unit', 'selling_price', 'category', 'notes']);

  expect(mapColumns(['Nama', 'SKU', 'Harga', 'Warna'])).toEqual([
    'name',
    'sku',
    'selling_price',
    null,
  ]);
});

test('kolom yang tidak dikenal tidak dipakai', () => {
  expect(mapColumns(['Warna', 'Ukuran'])).toEqual([null, null]);
  expect(mapColumns([null, ''])).toEqual([null, null]);
});
