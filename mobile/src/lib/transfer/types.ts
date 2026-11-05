/** Where the transfer proof came from. */
export type TransferProviderKind = 'bank' | 'ewallet' | 'qris' | 'unknown';

/**
 * Data shown on a transfer receipt. Every field is a plain string so the user
 * can correct anything the OCR misread before the receipt is printed.
 */
export interface TransferReceiptData {
  /** Bank or wallet named on the proof, e.g. "BCA" or "DANA". */
  provider: string;
  providerKind: TransferProviderKind;
  /** Transfer date as dd/mm/yyyy. */
  date: string;
  /** Transfer time as hh:mm or hh:mm:ss. */
  time: string;
  /** Amount in whole rupiah. */
  amount: number;
  /** Result line, e.g. "Berhasil". */
  status: string;
  /** Transaction type, e.g. "Transaksi Poket" or "Kirim Uang". */
  transactionType: string;
  /** Pocket / recipient / merchant name. */
  destinationName: string;
  /** Recipient bank, when the app prints it separately ("BANK BRI"). */
  destinationBank: string;
  /** Recipient account number or phone number. */
  destinationAccount: string;
  /** Sender name, when the app prints it separately. */
  sourceName: string;
  /** Sender account number (usually masked by the app). */
  sourceAccount: string;
  /** Payment source, e.g. "Saldo DANA (SmartPay)". */
  paymentMethod: string;
  /** Administration fee, 0 when the app does not charge one. */
  adminFee: number;
  /** One or more reference numbers, one per line. */
  reference: string;
  /** Label the source app uses for the reference, e.g. "ID Transaksi". */
  referenceLabel: string;
  /** Optional second identifier, e.g. "ID Order Merchant". */
  orderId: string;
  orderLabel: string;
}

export const EMPTY_TRANSFER_RECEIPT: TransferReceiptData = {
  provider: '',
  providerKind: 'unknown',
  date: '',
  time: '',
  amount: 0,
  status: '',
  transactionType: '',
  destinationName: '',
  destinationBank: '',
  destinationAccount: '',
  sourceName: '',
  sourceAccount: '',
  paymentMethod: '',
  adminFee: 0,
  reference: '',
  referenceLabel: '',
  orderId: '',
  orderLabel: '',
};

/** Enough data to make a receipt worth printing. */
export function isTransferReceiptUsable(data: TransferReceiptData): boolean {
  return (
    data.amount > 0 &&
    (data.reference.trim() !== '' ||
      data.destinationAccount.trim() !== '' ||
      data.destinationName.trim() !== '')
  );
}
