import { useEffect, useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonNote,
  IonPage,
  IonSpinner,
} from '@ionic/react';
import { checkmarkCircleOutline, printOutline, receiptOutline } from 'ionicons/icons';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { transactionsApi } from '../api/transactions';
import PrinterSettingsModal from '../components/PrinterSettingsModal';
import PageHeader from '../components/PageHeader';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import { useReceiptPrinter } from '../hooks/useReceiptPrinter';
import { formatDateTime, formatRupiah } from '../lib/format';
import { ApiError } from '../lib/http';
import { transactionKeys } from '../lib/queryKeys';
import { DEFAULT_PRINTER_SETTINGS, loadPrinterSettings, previewReceipt, type PrinterSettings } from '../services/printer';
import { paymentMethodLabel, type Transaction } from '../types';

/** 10 · Preview Struk — the styled receipt plus print actions. */
const Receipt: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const transactionId = (location.state as { id?: number } | null)?.id ?? null;
  const printer = useReceiptPrinter();

  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    void loadPrinterSettings().then((loaded) => {
      if (!cancelled) setSettings(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const query = useQuery({
    queryKey: transactionKeys.detail(transactionId ?? 0),
    queryFn: ({ signal }) => transactionsApi.get(transactionId as number, signal),
    enabled: transactionId !== null,
  });

  const transaction = query.data?.data;
  const error =
    query.isError &&
    (query.error instanceof ApiError ? query.error.message : 'Gagal memuat struk.');

  return (
    <IonPage>
      <IonContent>
        <PageHeader title="Preview Struk" backHref="/tabs/history" />

        <div className="screen">
          {transactionId === null ? (
            <div className="card empty-state">
              <IonIcon className="empty-state__icon" icon={receiptOutline} />
              <p className="empty-state__title">Belum ada struk dipilih</p>
              <p className="empty-state__text">Pilih transaksi di Riwayat untuk mencetak ulang.</p>
              <button
                type="button"
                className="btn btn--primary"
                style={{ marginTop: 16 }}
                onClick={() => navigate('/tabs/history')}
              >
                Buka Riwayat
              </button>
            </div>
          ) : (
            <>
              {query.isLoading && (
                <div className="spinner-center">
                  <IonSpinner name="crescent" />
                </div>
              )}

              {error && <IonNote className="note note--error">{error}</IonNote>}

              {transaction && (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      margin: '4px 0 14px',
                      color: 'var(--app-green)',
                    }}
                  >
                    <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: 19.8 }} />
                    <strong style={{ color: 'var(--app-ink)' }}>Pembayaran berhasil</strong>
                  </div>

                  <ReceiptCard transaction={transaction} settings={settings} />

                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ marginTop: 16 }}
                    onClick={() => void printer.print(transaction)}
                  >
                    <IonIcon icon={printOutline} /> Cetak Struk
                  </button>

                  <details style={{ marginTop: 14 }}>
                    <summary
                      style={{
                        cursor: 'pointer',
                        fontSize: 11.7,
                        fontWeight: 600,
                        color: 'var(--app-blue)',
                      }}
                    >
                      Lihat teks printer
                    </summary>
                    <pre className="receipt-card__mono" style={{ marginTop: 10 }}>
                      {previewReceipt(transaction, settings)}
                    </pre>
                  </details>

                  <div className="btn-row" style={{ marginTop: 16 }}>
                    <button
                      type="button"
                      className="btn btn--plain"
                      onClick={() => navigate('/tabs/pos', { replace: true })}
                    >
                      Transaksi Baru
                    </button>
                    <button
                      type="button"
                      className="btn btn--quiet"
                      onClick={() => navigate('/tabs/history', { replace: true })}
                    >
                      Riwayat
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </IonContent>

      <PrinterSettingsModal isOpen={printer.settingsOpen} onDismiss={printer.closeSettings} />

      <ReceiptPreviewModal
        isOpen={printer.preview !== null}
        title={printer.preview?.title ?? 'Struk'}
        text={printer.preview?.text ?? ''}
        onDismiss={printer.closePreview}
      />
    </IonPage>
  );
};

/** The mockup's paper-like receipt, built from the immutable snapshot. */
function ReceiptCard({
  transaction,
  settings,
}: {
  transaction: Transaction;
  settings: PrinterSettings;
}) {
  return (
    <div className="receipt-card">
      <div className="receipt-card__store">{settings.storeName || 'Warung'}</div>
      {settings.storeAddress?.trim() && (
        <div className="receipt-card__meta">{settings.storeAddress}</div>
      )}
      <div className="receipt-card__meta">{formatDateTime(transaction.created_at)}</div>
      <div className="receipt-card__meta">No: {transaction.transaction_number}</div>

      <hr className="receipt-card__rule" />

      {(transaction.items ?? []).map((item) => (
        <div key={item.id} className="receipt-card__item">
          <span>
            <span className="receipt-card__item-name">{item.product_name}</span>
            <span className="receipt-card__item-sub" style={{ display: 'block' }}>
              {item.quantity} × {formatRupiah(item.unit_price)}
            </span>
          </span>
          <span className="totals__value">{formatRupiah(item.line_total)}</span>
        </div>
      ))}

      <hr className="receipt-card__rule" />

      <div className="receipt-card__line">
        <span>Subtotal</span>
        <span className="totals__value">{formatRupiah(transaction.subtotal)}</span>
      </div>
      {transaction.discount_amount > 0 && (
        <div className="receipt-card__line">
          <span>Diskon</span>
          <span className="totals__value">-{formatRupiah(transaction.discount_amount)}</span>
        </div>
      )}
      <div className="receipt-card__line receipt-card__line--total">
        <span>Total</span>
        <span className="totals__value">{formatRupiah(transaction.total)}</span>
      </div>
      <div className="receipt-card__line">
        <span>{paymentMethodLabel(transaction.payment_method)}</span>
        <span className="totals__value">{formatRupiah(transaction.paid_amount)}</span>
      </div>
      {transaction.payment_method === 'cash' && (
        <div className="receipt-card__line">
          <span>Kembali</span>
          <span className="totals__value">{formatRupiah(transaction.change_amount)}</span>
        </div>
      )}

      <hr className="receipt-card__rule" />

      <div className="receipt-card__meta">
        {settings.footer?.trim() || 'Terima kasih telah berbelanja'}
      </div>
    </div>
  );
}

export default Receipt;
