import { IonContent, IonIcon, IonModal } from '@ionic/react';
import { printOutline } from 'ionicons/icons';
import { formatDateTime, formatRupiah } from '../lib/format';
import { paymentMethodBadge, paymentMethodLabel, type Transaction } from '../types';
import PageHeader from './PageHeader';

interface TransactionDetailModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  onDismiss: () => void;
  onPrint: (transaction: Transaction) => void;
}

const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  transaction,
  onDismiss,
  onPrint,
}) => {
  if (!transaction) return null;

  const items = transaction.items ?? [];
  const isCash = transaction.payment_method === 'cash';

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonContent>
        <PageHeader title="Detail Transaksi" onBack={onDismiss} />

        <div className="screen">
          <div className="card">
            <h2 style={{ margin: '0 0 4px', fontSize: 14.4, fontWeight: 700 }}>
              {transaction.transaction_number}
            </h2>
            <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: 10.8 }}>
              {formatDateTime(transaction.created_at)}
            </p>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <span className={`badge ${paymentMethodBadge(transaction.payment_method)}`}>
                {paymentMethodLabel(transaction.payment_method)}
              </span>
            </div>
          </div>

          <div className="card card--summary" style={{ marginTop: 12 }}>
            <h3 className="card__title" style={{ marginBottom: 10 }}>
              Item
            </h3>
            {items.map((item) => (
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
          </div>

          <div className="card card--summary" style={{ marginTop: 12 }}>
            <div className="totals">
              <div className="totals__row">
                <span>Subtotal</span>
                <span className="totals__value">{formatRupiah(transaction.subtotal)}</span>
              </div>
              {transaction.discount_amount > 0 && (
                <div className="totals__row">
                  <span>Diskon</span>
                  <span className="totals__value">
                    -{formatRupiah(transaction.discount_amount)}
                  </span>
                </div>
              )}
              <hr className="totals__divider" />
              <div className="totals__row totals__row--strong">
                <span>Total</span>
                <span className="totals__value">{formatRupiah(transaction.total)}</span>
              </div>
              <div className="totals__row">
                <span>{paymentMethodLabel(transaction.payment_method)}</span>
                <span className="totals__value">{formatRupiah(transaction.paid_amount)}</span>
              </div>
              {isCash && (
                <div className="totals__row">
                  <span>Kembalian</span>
                  <span className="totals__value">{formatRupiah(transaction.change_amount)}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 16 }}
            onClick={() => onPrint(transaction)}
          >
            <IonIcon icon={printOutline} /> Cetak struk
          </button>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default TransactionDetailModal;
