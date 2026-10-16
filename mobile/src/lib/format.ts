/** Formats an integer rupiah amount, e.g. 4000 -> "Rp 4.000". */
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Formats an ISO timestamp in the local timezone, e.g. "16 Okt 2026, 20.15". */
export function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Keeps only the digits of a typed amount, e.g. "Rp 20.000" -> "20000". */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Groups digits with dots while typing, e.g. "20000" -> "20.000". */
export function formatThousands(value: string): string {
  return digitsOnly(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
