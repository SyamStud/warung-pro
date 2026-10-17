import { mapColumns, parsePrice, text } from './cells';
import type { Cell, ImportField, ImportIssue, ImportRow, PreparedImport } from './types';

/** How far down a spreadsheet the header row is looked for. */
const HEADER_SEARCH_ROWS = 10;

/** Rows accepted in one file. Mirrors ProductImporter::MAX_ROWS. */
export const MAX_ROWS = 500;

function isBlankRow(row: Cell[]): boolean {
  return row.every((cell) => text(cell) === null);
}

/** A header is usable when it names the product and something else. */
function isHeader(fields: (ImportField | null)[]): boolean {
  const known = fields.filter((field) => field !== null);

  return fields.includes('name') && known.length >= 2;
}

/**
 * Turns a sheet into the rows the API takes.
 *
 * The header decides which column is which. Only the two things the catalog
 * cannot do without — a name and a price — are judged here, so the preview can
 * say what is wrong before anything is sent; everything that needs the catalog
 * (a SKU already in use, a repeated row) is answered by the server.
 */
export function buildImport(matrix: Cell[][]): PreparedImport {
  const headerIndex = matrix.findIndex(
    (row, index) => index < HEADER_SEARCH_ROWS && isHeader(mapColumns(row ?? [])),
  );

  if (headerIndex === -1) {
    return { header: null, rows: [], issues: [], total: 0 };
  }

  const fields = mapColumns(matrix[headerIndex] ?? []);
  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  let total = 0;

  for (let index = headerIndex + 1; index < matrix.length; index++) {
    const cells = matrix[index] ?? [];
    if (isBlankRow(cells)) continue;

    total++;

    const value = (field: ImportField): Cell | undefined => {
      const column = fields.indexOf(field);

      return column === -1 ? undefined : cells[column];
    };

    const row = index + 1;
    const name = text(value('name'));
    const sku = text(value('sku'));
    const price = parsePrice(value('selling_price'));

    if (name === null) {
      issues.push({ row, name: sku, message: 'Nama produk kosong.' });
      continue;
    }

    if (name.length > 255) {
      issues.push({ row, name, message: 'Nama produk lebih dari 255 karakter.' });
      continue;
    }

    if (price === null) {
      issues.push({ row, name, message: 'Harga jual kosong atau tidak terbaca.' });
      continue;
    }

    rows.push({
      row,
      name,
      sku,
      unit: text(value('unit')) ?? 'pcs',
      selling_price: price,
      category: text(value('category')),
      notes: text(value('notes')),
    });
  }

  return { header: { row: headerIndex + 1, fields }, rows, issues, total };
}
