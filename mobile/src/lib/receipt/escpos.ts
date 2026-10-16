import { buildReceiptLines, dividerLine, padRow } from './layout';
import { PAPER_COLUMNS, type ReceiptLine, type ReceiptOptions } from './types';

const ESC = 0x1b;
const GS = 0x1d;

/** Encode printable ASCII; anything else becomes '?' so no byte is silently lost. */
function ascii(text: string): number[] {
  const out: number[] = [];

  for (const char of text) {
    const code = char.codePointAt(0) ?? 0x3f;
    out.push(code >= 0x20 && code <= 0x7e ? code : 0x3f);
  }

  return out;
}

/**
 * Render receipt lines into an ESC/POS byte stream.
 *
 * Commands are the common denominator supported by 58mm and 80mm clones:
 * initialise, select code page PC437, alignment, bold, double size, feed, and a
 * partial cut (ignored by printers without a cutter).
 */
export function renderEscPos(lines: ReceiptLine[], options: ReceiptOptions): Uint8Array {
  const columns = PAPER_COLUMNS[options.paperWidth];
  const bytes: number[] = [];

  bytes.push(ESC, 0x40); // initialise
  bytes.push(ESC, 0x74, 0x00); // code page PC437

  for (const line of lines) {
    switch (line.kind) {
      case 'divider': {
        bytes.push(ESC, 0x61, 0x00, ...ascii(dividerLine(columns)), 0x0a);
        break;
      }

      case 'text': {
        const align = line.align ?? 'left';
        bytes.push(ESC, 0x61, align === 'center' ? 0x01 : align === 'right' ? 0x02 : 0x00);
        if (line.bold) bytes.push(ESC, 0x45, 0x01);
        bytes.push(GS, 0x21, line.double ? 0x11 : 0x00);

        const limit = line.double ? Math.floor(columns / 2) : columns;
        bytes.push(...ascii(line.text.slice(0, limit)), 0x0a);

        bytes.push(GS, 0x21, 0x00);
        if (line.bold) bytes.push(ESC, 0x45, 0x00);
        break;
      }

      case 'row': {
        bytes.push(ESC, 0x61, 0x00);
        if (line.bold) bytes.push(ESC, 0x45, 0x01);
        bytes.push(...ascii(padRow(line.left, line.right, columns)), 0x0a);
        if (line.bold) bytes.push(ESC, 0x45, 0x00);
        break;
      }

      case 'feed': {
        bytes.push(ESC, 0x64, 0x03); // feed 3 lines before cutting
        break;
      }
    }
  }

  bytes.push(GS, 0x56, 0x42, 0x00); // partial cut

  return Uint8Array.from(bytes);
}

export function buildReceiptBytes(transaction: Parameters<typeof buildReceiptLines>[0], options: ReceiptOptions): Uint8Array {
  return renderEscPos(buildReceiptLines(transaction, options), options);
}
