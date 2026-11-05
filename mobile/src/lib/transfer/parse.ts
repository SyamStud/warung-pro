import { EMPTY_TRANSFER_RECEIPT, type TransferProviderKind, type TransferReceiptData } from './types';

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  mei: 5,
  may: 5,
  jun: 6,
  jul: 7,
  agu: 8,
  agt: 8,
  aug: 8,
  sep: 9,
  okt: 10,
  oct: 10,
  nov: 11,
  des: 12,
  dec: 12,
};

/** Apps we recognise, checked in order. Wallets come first because their
 *  names are more specific than the bank word that may also appear. */
const PROVIDERS: Array<{ name: string; kind: TransferProviderKind; pattern: RegExp }> = [
  { name: 'DANA', kind: 'ewallet', pattern: /^\s*dana\s*$|\b(?:id|akun|saldo)\s+dana\b|dana\s*\(\s*smartpay/i },
  { name: 'ShopeePay', kind: 'ewallet', pattern: /shopeepay|shopee\s*pay/i },
  { name: 'GoPay', kind: 'ewallet', pattern: /\bgopay\b/i },
  { name: 'OVO', kind: 'ewallet', pattern: /\bovo\b/i },
  { name: 'LinkAja', kind: 'ewallet', pattern: /\blinkaja\b/i },
  { name: 'BCA', kind: 'bank', pattern: /\bbca\b|klikbca|m-bca/i },
  { name: 'BRI', kind: 'bank', pattern: /\bbri\b|brimo/i },
  { name: 'BNI', kind: 'bank', pattern: /\bbni\b|wondr/i },
  { name: 'Mandiri', kind: 'bank', pattern: /\bmandiri\b|livin/i },
  { name: 'BSI', kind: 'bank', pattern: /\bbsi\b|bank syariah indonesia/i },
  { name: 'CIMB', kind: 'bank', pattern: /\bcimb\b|octo/i },
  { name: 'Permata', kind: 'bank', pattern: /\bpermata\b/i },
  { name: 'Danamon', kind: 'bank', pattern: /\bdanamon\b/i },
  { name: 'BTN', kind: 'bank', pattern: /\bbtn\b/i },
  { name: 'Jago', kind: 'bank', pattern: /\bjago\b/i },
  { name: 'SeaBank', kind: 'bank', pattern: /\bseabank\b/i },
];

const FIELD_LABELS: Record<string, RegExp[]> = {
  destinationName: [
    /^poket tujuan\b/i,
    /^nama penerima\b/i,
    /^nama tujuan\b/i,
    /^penerima\b/i,
    /^nama merchant\b/i,
    /^nama toko\b/i,
    /^merchant\b/i,
    /^tujuan\b/i,
    /^nama$/i,
  ],
  destinationAccount: [
    /^akun dana\b/i,
    /^akun ovo\b/i,
    /^akun gopay\b/i,
    /^akun shopee\w*\b/i,
    /^akun linkaja\b/i,
    /^akun tujuan\b/i,
    /^akun\b/i,
    /^no\.?\s*rekening(?:\s+poket)?\b/i,
    /^nomor rekening\b/i,
    /^rekening tujuan\b/i,
    /^nomor tujuan\b/i,
    /^no\.?\s*hp\b/i,
    /^nomor hp\b/i,
    /^tujuan\b/i,
  ],
  destinationBank: [/^bank tujuan\b/i, /^bank penerima\b/i],
  sourceAccount: [
    /^id dana\b/i,
    /^sumber dana\b/i,
    /^sumber\b/i,
    /^dari\b/i,
    /^pengirim\b/i,
    /^akun pengirim\b/i,
    /^no\.?\s*rekening pengirim\b/i,
    /^no\.?\s*hp pengirim\b/i,
  ],
  paymentMethod: [
    /^metode pembayaran\b/i,
    /^metode\b/i,
  ],
  transactionType: [
    /^jenis transaksi\b/i,
    /^tipe transaksi\b/i,
    /^jenis\b/i,
  ],
  status: [/^status\b/i],
  reference: [
    /^id transaksi\b/i,
    /^no\.?\s*referensi\b/i,
    /^nomor referensi\b/i,
    /^no\.?\s*ref\b/i,
    /^referensi\b/i,
    /^kode transaksi\b/i,
    /^nomor transaksi\b/i,
  ],
  order: [
    /^id order merchant\b/i,
    /^id order\b/i,
    /^no\.?\s*order\b/i,
    /^order id\b/i,
    /^nmid\b/i,
  ],
  fee: [/^biaya admin\b/i, /^biaya layanan\b/i, /^biaya transfer\b/i],
};

/** Lines that end a value, even when they are not fields we print. */
const STOP_LABELS: RegExp[] = [
  ...Object.values(FIELD_LABELS).flat(),
  /^detail\b/i,
  /^rincian\b/i,
  /^nominal\b/i,
  /^jumlah\b/i,
  /^total\b/i,
  /^total bayar\b/i,
  /^total pembayaran\b/i,
  /^tanggal\b/i,
  /^waktu\b/i,
  /^jam\b/i,
  /^waktu transaksi\b/i,
  /^bank\b/i,
  /^biaya\b/i,
  /^admin\b/i,
  /^berita\b/i,
  /^catatan\b/i,
];

function flat(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalize(value: string): string {
  return flat(value)
    .toLowerCase()
    .replace(/^[\s•·*]+|[\s:]+$/g, '')
    .trim();
}

function matchesLabel(line: string, pattern: RegExp): boolean {
  return pattern.test(flat(line));
}

function isLabelLine(line: string): boolean {
  const text = flat(line);
  return STOP_LABELS.some((pattern) => pattern.test(text));
}

/** Gives the text after a label on the same line, or null when it is not one. */
function inlineValue(line: string, pattern: RegExp): string | null {
  const text = flat(line);
  const match = pattern.exec(text);

  if (!match || match.index !== 0) return null;

  return text
    .slice(match[0].length)
    .replace(/^[\s:：–—-]+/, '')
    .trim();
}

function labelText(line: string, pattern: RegExp): string {
  const text = flat(line);
  const match = pattern.exec(text);

  return match ? text.slice(0, match[0].length).replace(/[\s:]+$/, '') : '';
}

interface CollectOptions {
  multi?: boolean;
  join?: string;
  requireDigit?: boolean;
  skipWords?: RegExp;
}

/**
 * Finds the first label that has a value and returns both.
 *
 * Values may sit next to the label ("ID DANA 0813...") or below it, and some
 * apps split a long number over two lines — `multi` keeps reading until the
 * next label appears.
 */
function collect(
  lines: string[],
  patterns: RegExp[],
  options: CollectOptions = {},
): { value: string; label: string } {
  const skipWords = options.skipWords ?? /^(tujuan|poket|dana|transaksi|referensi|penerima|nama|hp)$/;

  for (let index = 0; index < lines.length; index += 1) {
    for (const pattern of patterns) {
      if (!matchesLabel(lines[index], pattern)) continue;

      const inline = inlineValue(lines[index], pattern);
      const values: string[] = [];

      if (inline && (!options.requireDigit || /\d/.test(inline))) {
        values.push(inline);

        if (!options.multi) {
          return { value: inline, label: labelText(lines[index], pattern) };
        }
      }

      if (values.length === 0 && inline !== null && options.requireDigit) {
        // Label with something unreadable on the same line; keep looking below.
      }

      for (let next = index + 1; next < lines.length; next += 1) {
        const candidate = lines[next];

        if (skipWords.test(normalize(candidate))) continue;
        if (isLabelLine(candidate)) break;
        if (options.requireDigit && !/\d/.test(candidate)) {
          if (values.length > 0) break;
          continue;
        }

        values.push(flat(candidate));

        if (!options.multi) break;
        if (values.length >= 4) break;
      }

      if (values.length > 0) {
        return {
          value: values.join(options.join ?? ' '),
          label: labelText(lines[index], pattern),
        };
      }
    }
  }

  return { value: '', label: '' };
}

function splitLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map(flat)
    .filter(Boolean);
}

function two(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDate(year: number, month: number, day: number): string {
  return `${two(day)}/${two(month)}/${year}`;
}

/** Reads "02 Nov 2026", "27/04/2026" or "2026-11-02" from anywhere in the text. */
export function parseTransferDate(raw: string): string {
  const named = raw.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})/);

  if (named) {
    const month = MONTHS[named[2].slice(0, 3).toLowerCase()];

    if (month) return formatDate(Number(named[3]), month, Number(named[1]));
  }

  const numeric = raw.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/);

  if (numeric) {
    return formatDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  }

  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);

  if (iso) {
    return formatDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  return '';
}

/** Reads "01:38:57" or "11:48" from anywhere in the text. */
export function parseTransferTime(raw: string): string {
  const match = raw.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.]([0-5]\d))?\b/);

  if (!match) return '';

  const seconds = match[3] ? `:${match[3]}` : '';
  return `${two(Number(match[1]))}:${match[2]}${seconds}`;
}

/**
 * Parses an amount written the way banks and wallets print it.
 *
 * Handles both "20,000.00" (English) and "20.000,00" (Indonesian), including
 * amounts without decimals such as "20.000" or "20,000".
 */
export function parseAmount(value: string): number {
  const cleaned = value.replace(/[^\d.,-]/g, '');

  if (!cleaned) return 0;

  const negative = cleaned.startsWith('-');
  let body = cleaned.replace(/-/g, '');
  const lastDot = body.lastIndexOf('.');
  const lastComma = body.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    if (lastComma > lastDot) {
      // 20.000,00 — dots group thousands, comma is the decimal mark.
      body = body.replace(/\./g, '').replace(',', '.');
    } else {
      // 20,000.00 — commas group thousands, dot is the decimal mark.
      body = body.replace(/,/g, '');
    }
  } else if (lastComma >= 0) {
    const decimals = body.length - lastComma - 1;
    const grouped = /^\d{1,3}(,\d{3})+$/.test(body);
    body = grouped && decimals === 3 ? body.replace(/,/g, '') : body.replace(',', '.');
  } else if (lastDot >= 0) {
    const grouped = /^\d{1,3}(\.\d{3})+$/.test(body);
    body = grouped ? body.replace(/\./g, '') : body;
  }

  const amount = Number.parseFloat(body);

  if (!Number.isFinite(amount)) return 0;

  return Math.round(negative ? -amount : amount);
}

function amountOnLine(line: string): number {
  const match = line.match(/(?:IDR|Rp\.?)\s*([\d.,]+)/i);
  return match ? parseAmount(match[1]) : 0;
}

const AMOUNT_LABELS = /^(nominal|jumlah|total(?:\s+bayar|\s+pembayaran|\s+transfer)?)\b/i;

function parseAmountFromLines(lines: string[]): number {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!AMOUNT_LABELS.test(line)) continue;

    const amount = amountOnLine(line);

    if (amount > 0) return amount;

    // Value printed on the next line (right-aligned in most app layouts).
    const next = lines[index + 1];

    if (next) {
      const below = amountOnLine(next);

      if (below > 0) return below;
    }
  }

  for (const line of lines) {
    const amount = amountOnLine(line);

    if (amount > 0) return amount;
  }

  return 0;
}

function detectProvider(raw: string): { name: string; kind: TransferProviderKind } {
  for (const provider of PROVIDERS) {
    if (provider.pattern.test(raw)) {
      return { name: provider.name, kind: provider.kind };
    }
  }

  if (/\bqris\b/i.test(raw)) {
    return { name: 'QRIS', kind: 'qris' };
  }

  return { name: '', kind: 'unknown' };
}

const TYPE_WORDS =
  /^(kirim uang|transfer|top up|isi saldo|tarik tunai|tarik dana|pembayaran|bayar|tambah dana|beli pulsa|bayar tagihan)\b/i;

function deriveTransactionType(lines: string[]): string {
  for (const line of lines) {
    if (isLabelLine(line)) continue;

    const match = line.match(TYPE_WORDS);

    if (match) return match[1];
  }

  return '';
}

function deriveStatus(lines: string[]): string {
  for (const line of lines) {
    if (/\bberhasil\b/i.test(line)) return 'Berhasil';
  }

  return '';
}

/**
 * Some banks print the sender's name above the account number ("VINA
 * VEBRIANTI" then "1859 **** **** 505"). Wallet proofs usually only show the
 * masked wallet id, so no name is returned for those.
 */
function deriveSourceName(lines: string[]): string {
  const labels = [/^sumber dana\b/i, /^nama pengirim\b/i, /^pengirim\b/i, /^dari\b/i];

  for (let index = 0; index < lines.length; index += 1) {
    const pattern = labels.find((candidate) => matchesLabel(lines[index], candidate));

    if (!pattern) continue;

    const inline = inlineValue(lines[index], pattern);

    if (inline && /[A-Za-z]{2,}/.test(inline) && !/^\d/.test(inline)) return inline;

    for (let next = index + 1; next < Math.min(index + 4, lines.length); next += 1) {
      const candidate = lines[next];

      if (isLabelLine(candidate)) break;
      if (!/[A-Za-z]{2,}/.test(candidate)) continue;

      return candidate;
    }
  }

  return '';
}

/** First "Biaya Admin"/"Biaya Layanan" line that carries a rupiah amount. */
function parseAdminFee(lines: string[]): number {
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^biaya\b/i.test(lines[index])) continue;

    if (/(?:IDR|Rp)/i.test(lines[index])) return amountOnLine(lines[index]);

    const next = lines[index + 1];

    if (next && /(?:IDR|Rp)/i.test(next)) return amountOnLine(next);
  }

  return 0;
}

function detectReference(raw: string): string {
  const matches = raw.match(/\b\d{10,}\b/g);

  return matches ? [...new Set(matches)].join('\n') : '';
}

/**
 * Extracts transfer fields from text recognized on a payment proof screenshot.
 *
 * The parser is provider-agnostic: banks (BCA, BRI, ...) and wallets (DANA,
 * OVO, GoPay, ShopeePay, ...) all use the same labels with small differences.
 * When an app changes its wording, generic fallbacks (currency amount, long
 * digit strings, "kirim uang ... ke ...") keep the form usable, and the user
 * can correct anything before printing.
 */
export function parseTransferReceipt(raw: string): TransferReceiptData {
  const lines = splitLines(raw);
  const text = lines.join('\n');
  const provider = detectProvider(text);

  const destination = collect(lines, FIELD_LABELS.destinationName, {
    multi: false,
    skipWords: /^(penerima|nama|tujuan|merchant)$/,
  });

  const destinationAccount = collect(lines, FIELD_LABELS.destinationAccount, {
    multi: true,
    requireDigit: true,
    skipWords: /^(tujuan|poket|dana|transaksi|referensi|penerima|nama|hp|rekening)$/,
  });

  const accountFallback = text.match(/\bke\s+(\d{8,})\b/i);

  const source = collect(lines, FIELD_LABELS.sourceAccount, {
    multi: false,
    requireDigit: true,
    skipWords: /^(dana|sumber|pengirim)$/,
  });

  const payment = collect(lines, FIELD_LABELS.paymentMethod, { multi: false });

  const typeFromLabel = collect(lines, FIELD_LABELS.transactionType, { multi: false });

  const statusFromLabel = collect(lines, FIELD_LABELS.status, { multi: false });

  const reference = collect(lines, FIELD_LABELS.reference, {
    multi: true,
    join: '\n',
    requireDigit: true,
    skipWords: /^(transaksi|referensi|ref)$/,
  });

  const order = collect(lines, FIELD_LABELS.order, {
    multi: true,
    join: '',
    skipWords: /^(order|merchant|transaksi)$/,
  });

  const destinationBank = collect(lines, FIELD_LABELS.destinationBank, { multi: false });

  const referenceFallback = reference.value ? '' : detectReference(text);
  const referenceValue = reference.value || referenceFallback;

  return {
    ...EMPTY_TRANSFER_RECEIPT,
    provider: provider.name,
    providerKind: provider.kind,
    date: parseTransferDate(text),
    time: parseTransferTime(text),
    amount: parseAmountFromLines(lines),
    status: statusFromLabel.value || deriveStatus(lines),
    transactionType: typeFromLabel.value || deriveTransactionType(lines),
    destinationName: destination.value,
    destinationBank: destinationBank.value,
    destinationAccount:
      destinationAccount.value || (accountFallback ? accountFallback[1] : ''),
    sourceName: deriveSourceName(lines),
    sourceAccount: source.value,
    paymentMethod: payment.value,
    adminFee: parseAdminFee(lines),
    reference: referenceValue,
    referenceLabel: reference.value ? reference.label : referenceValue ? 'No. Referensi' : '',
    orderId: order.value,
    orderLabel: order.value ? order.label : '',
  };
}
