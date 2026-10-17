import { expect, test } from 'vitest';
import { parseCsv } from './csv';

test('memisahkan baris dengan koma', () => {
  expect(parseCsv('Nama,Harga\nIndomie,3000\nTeh Kotak,5000')).toEqual([
    ['Nama', 'Harga'],
    ['Indomie', '3000'],
    ['Teh Kotak', '5000'],
  ]);
});

test('mengenali titik koma dan tab seperti yang dipakai Excel', () => {
  expect(parseCsv('Nama;Harga\nIndomie;3.000')).toEqual([
    ['Nama', 'Harga'],
    ['Indomie', '3.000'],
  ]);

  expect(parseCsv('Nama\tHarga\nIndomie\t3000')).toEqual([
    ['Nama', 'Harga'],
    ['Indomie', '3000'],
  ]);
});

test('menghormati tanda kutip, termasuk pemisah dan baris baru di dalamnya', () => {
  expect(parseCsv('Nama,Harga\n"Mie, Goreng",3000')).toEqual([
    ['Nama', 'Harga'],
    ['Mie, Goreng', '3000'],
  ]);

  expect(parseCsv('Nama,Catatan\n"Mie\nGoreng",enak')).toEqual([
    ['Nama', 'Catatan'],
    ['Mie\nGoreng', 'enak'],
  ]);

  expect(parseCsv('Nama,Catatan\n"""Spesial""",enak')).toEqual([
    ['Nama', 'Catatan'],
    ['"Spesial"', 'enak'],
  ]);
});

test('membuang BOM dan CR dari berkas Excel', () => {
  expect(parseCsv('\uFEFFNama,Harga\r\nIndomie,3000\r\n')).toEqual([
    ['Nama', 'Harga'],
    ['Indomie', '3000'],
  ]);
});

test('baris terakhir tanpa penutup baris tetap terbaca', () => {
  expect(parseCsv('Nama,Harga\nIndomie,3000')).toHaveLength(2);
  expect(parseCsv('Nama,Harga\nIndomie,3000\n')).toHaveLength(2);
});

test('sel kosong di ujung baris tetap dihitung', () => {
  expect(parseCsv('Nama,SKU,Harga\nIndomie,,3000')).toEqual([
    ['Nama', 'SKU', 'Harga'],
    ['Indomie', '', '3000'],
  ]);
});

test('berkas kosong tidak menghasilkan baris', () => {
  expect(parseCsv('')).toEqual([]);
});
