/** A cell exactly as the reader returns it: text, number, date or empty. */
export type Cell = string | number | boolean | Date | null;

/** The catalog fields a spreadsheet column can fill. */
export type ImportField = 'name' | 'sku' | 'unit' | 'selling_price' | 'category' | 'notes';

/** One product row, mapped and cleaned up, ready to send. */
export interface ImportRow {
  /** 1-based number of this row in the sheet, so messages can point at it. */
  row: number;
  name: string;
  sku: string | null;
  unit: string;
  selling_price: number;
  category: string | null;
  notes: string | null;
}

/** A row that could not be used, with the reason to show the user. */
export interface ImportIssue {
  row: number;
  name: string | null;
  message: string;
}

export interface PreparedImport {
  /** The header the file was read with, or null when it is not understood. */
  header: { row: number; fields: (ImportField | null)[] } | null;
  rows: ImportRow[];
  issues: ImportIssue[];
  /** Data rows read, blank lines excluded. */
  total: number;
}

/** What the server answers with once an import has run. */
export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  categories_created: string[];
  issues: ImportIssue[];
}
