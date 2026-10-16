/**
 * Formats an integer amount for a receipt, e.g. 4000 -> "Rp 4.000".
 *
 * Deliberately avoids `Intl`, which can emit a non-breaking space between the
 * currency and the number — that byte is not printable on ESC/POS printers.
 */
export function formatAmount(value: number): string {
  const rounded = Math.trunc(value);
  const negative = rounded < 0;
  const grouped = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  return `${negative ? '-' : ''}Rp ${grouped}`;
}
