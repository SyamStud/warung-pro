import { parseCsv } from './csv';
import type { Cell } from './types';

/**
 * Reads the spreadsheet the user picked.
 *
 * .csv is read as text — that is what Excel writes for "Simpan sebagai CSV" —
 * and .xlsx is parsed inside the app: no upload, and no spreadsheet library on
 * the server. The .xlsx reader is loaded on demand, so its weight is only paid
 * when somebody actually imports.
 */
export async function readImportFile(file: File): Promise<Cell[][]> {
  if (/\.(csv|txt)$/i.test(file.name)) {
    return parseCsv(await file.text());
  }

  const { readSheet } = await import('read-excel-file/browser');

  // The first sheet is the one a warung keeps its price list on. The library
  // types a date cell as `typeof Date`, so the result is taken as plain cell
  // values and `text()`/`parsePrice()` decide what each one is worth.
  return (await readSheet(file)) as unknown as Cell[][];
}
