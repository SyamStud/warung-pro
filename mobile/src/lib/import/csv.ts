/**
 * Splits CSV text into rows of cells.
 *
 * Excel writes a BOM, quotes anything containing the separator, and on an
 * Indonesian Windows install saves with ";" instead of "," — all three are
 * handled here so a sheet saved as CSV imports exactly like the .xlsx it came
 * from.
 */
export function parseCsv(input: string): string[][] {
  const content = input.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(content);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];

    if (quoted) {
      if (char === '"') {
        if (content[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }

      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char !== '\r') {
      cell += char;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/** The separator that appears most often in the first non-empty line. */
function detectDelimiter(content: string): string {
  const line = content.split(/\r?\n/).find((candidate) => candidate.trim() !== '') ?? '';

  return [',', ';', '\t']
    .map((delimiter) => ({ delimiter, count: line.split(delimiter).length - 1 }))
    .reduce((best, current) => (current.count > best.count ? current : best)).delimiter;
}
