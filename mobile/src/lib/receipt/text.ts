import { buildReceiptLines, centerVisual, dividerLine, padRow } from './layout';
import { PAPER_COLUMNS, type ReceiptLine, type ReceiptOptions } from './types';
import type { Transaction } from '../../types';

/**
 * Render receipt lines as plain text using the same wrapping as the ESC/POS
 * renderer — used for the in-app preview when no printer is available.
 */
export function renderText(lines: ReceiptLine[], options: ReceiptOptions): string {
  const columns = PAPER_COLUMNS[options.paperWidth];
  const out: string[] = [];

  for (const line of lines) {
    switch (line.kind) {
      case 'divider':
        out.push(dividerLine(columns));
        break;

      case 'text': {
        const limit = line.double ? Math.floor(columns / 2) : columns;
        const text = line.text.slice(0, limit);
        if (line.align === 'center') out.push(centerVisual(text, columns, line.double ? 2 : 1));
        else if (line.align === 'right') out.push(text.padStart(columns));
        else out.push(text);
        break;
      }

      case 'row':
        out.push(padRow(line.left, line.right, columns));
        break;

      case 'feed':
        out.push('');
        break;
    }
  }

  return out.join('\n');
}

export function buildReceiptText(transaction: Transaction, options: ReceiptOptions): string {
  return renderText(buildReceiptLines(transaction, options), options);
}
