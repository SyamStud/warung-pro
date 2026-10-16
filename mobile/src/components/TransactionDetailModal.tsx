import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { printOutline } from 'ionicons/icons';
import { formatDateTime, formatRupiah } from '../lib/format';
import { paymentMethodLabel, type Transaction } from '../types';

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
      <IonHeader className="app-header">
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>Tutup</IonButton>
          </IonButtons>
          <IonTitle className="app-title-bar">Detail Transaksi</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="screen">
          <div className="card">
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700 }}>
              {transaction.transaction_number}
            </h2>
            <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: 13 }}>
              {formatDateTime(transaction.created_at)}
            </p>

            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <span
                className={`badge ${
                  transaction.status === 'paid' ? 'badge--green' : 'badge--grey'
                }`}
              >
                {transaction.status === 'paid' ? 'Lunas' : 'Dibatalkan'}
              </span>
              <span className="badge badge--blue">
                {paymentMethodLabel(transaction.payment_method)}
              </span>
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h3 className="card__title" style={{ marginBottom: 10 }}>
              Item ({items.length})
            </h3>
            {items.map((item) => (
              <div key={item.id} className="receipt-card__item">
                <span>
                  <span className="receipt-card__item-name">{item.product_name}</span>
                  <span className="receipt-card__item-sub" style={{ display: 'block' }}>
                    {item.quantity} × {formatRupiah(item.unit_price)}
                    {item.sku ? ` · ${item.sku}` : ''}
                  </span>
                </span>
                <span className="totals__value">{formatRupiah(item.line_total)}</span>
              </div>
            ))}
          </div>

          <div className="card" style={{ marginTop: 12 }}>
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
