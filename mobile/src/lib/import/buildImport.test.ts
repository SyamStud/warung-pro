import { expect, test } from 'vitest';
import { buildImport } from './buildImport';
import type { Cell } from './types';

const sheet = (...rows: Cell[][]): Cell[][] => rows;

test('membaca baris sesuai judul kolomnya, bukan urutannya', () => {
  const prepared = buildImport(
    sheet(
      ['Harga Jual', 'Nama Produk', 'Satuan', 'Kategori'],
      ['5.000', 'Teh Kotak 200ml', 'pcs', 'Minuman'],
      [3000, 'Indomie Goreng', 'porsi', 'Makanan'],
    ),
  );

  expect(prepared.header).toEqual({ row: 1, fields: ['selling_price', 'name', 'unit', 'category'] });
  expect(prepared.total).toBe(2);
  expect(prepared.issues).toEqual([]);
  expect(prepared.rows).toEqual([
    {
      row: 2,
      name: 'Teh Kotak 200ml',
      sku: null,
      unit: 'pcs',
      selling_price: 5000,
      category: 'Minuman',
      notes: null,
    },
    {
      row: 3,
      name: 'Indomie Goreng',
      sku: null,
      unit: 'porsi',
      selling_price: 3000,
      category: 'Makanan',
      notes: null,
    },
  ]);
});

test('judul kolom boleh berada di bawah baris keterangan', () => {
  const prepared = buildImport(
    sheet(
      ['Daftar Harga Warung', null, null],
      ['Nama', 'Harga'],
      ['Kopi Sachet', 2500],
    ),
  );

  expect(prepared.header?.row).toBe(2);
  expect(prepared.rows[0]).toMatchObject({ row: 3, name: 'Kopi Sachet', selling_price: 2500 });
});

test('satuan default pcs dan SKU kosong tetap kosong untuk dibuat server', () => {
  const prepared = buildImport(sheet(['Nama', 'Harga'], ['Gula Pasir', '14.000']));

  expect(prepared.rows[0]).toMatchObject({ unit: 'pcs', sku: null, category: null, notes: null });
});

test('baris tanpa nama atau harga dilaporkan dengan nomor barisnya', () => {
  const prepared = buildImport(
    sheet(
      ['Nama', 'Harga', 'SKU'],
      ['', 3000, '8990000000001'],
      ['Tanpa harga'],
      ['Mie Instan', 3200],
    ),
  );

  expect(prepared.total).toBe(3);
  expect(prepared.rows).toHaveLength(1);
  expect(prepared.rows[0].name).toBe('Mie Instan');
  expect(prepared.issues).toEqual([
    { row: 2, name: '8990000000001', message: 'Nama produk kosong.' },
    { row: 3, name: 'Tanpa harga', message: 'Harga jual kosong atau tidak terbaca.' },
  ]);
});

test('baris kosong dilewati tanpa dianggap kesalahan', () => {
  const prepared = buildImport(
    sheet(['Nama', 'Harga'], ['Kopi', 2500], [null, null], ['', ''], ['Teh', '5.000']),
  );

  expect(prepared.total).toBe(2);
  expect(prepared.rows).toHaveLength(2);
  expect(prepared.issues).toEqual([]);
});

test('berkas tanpa kolom yang dikenali tidak dipaksakan', () => {
  const prepared = buildImport(sheet(['Warna', 'Ukuran'], ['Merah', 'L']));

  expect(prepared.header).toBe(null);
  expect(prepared.rows).toEqual([]);
  expect(prepared.total).toBe(0);
});

test('judul yang hanya punya satu kolom dikenal tidak dianggap judul', () => {
  const prepared = buildImport(sheet(['Nama', 'Warna'], ['Kopi', 'Merah']));

  expect(prepared.header).toBe(null);
});

test('catatan dan SKU ikut terbaca', () => {
  const prepared = buildImport(
    sheet(
      ['Nama', 'SKU', 'Harga', 'Catatan'],
      ['Teh Kotak', '8991234567891', '5.000', 'titipan Bu Ani'],
    ),
  );

  expect(prepared.rows[0]).toMatchObject({
    sku: '8991234567891',
    notes: 'titipan Bu Ani',
  });
});
