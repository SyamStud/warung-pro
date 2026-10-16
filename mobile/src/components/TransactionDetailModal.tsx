import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { printOutline } from 'ionicons/icons';
import { formatDateTime, formatRupiah } from '../lib/format';
import type { Transaction } from '../types';

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

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>Tutup</IonButton>
          </IonButtons>
          <IonTitle>Detail Transaksi</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <h2 style={{ marginTop: 0 }}>{transaction.transaction_number}</h2>
        <IonNote color="medium">{formatDateTime(transaction.created_at)}</IonNote>
        <div className="ion-margin-top">
          <IonBadge color={transaction.status === 'paid' ? 'success' : 'medium'}>
            {transaction.status === 'paid' ? 'Lunas' : 'Dibatalkan'}
          </IonBadge>
        </div>

        <IonList>
          <IonListHeader>
            <IonLabel>Item</IonLabel>
          </IonListHeader>
          {items.map((item) => (
            <IonItem key={item.id}>
              <IonLabel>
                <h2>{item.product_name}</h2>
                <p>
                  {item.quantity} × {formatRupiah(item.unit_price)}
                </p>
              </IonLabel>
              <div slot="end" style={{ fontWeight: 600 }}>
                {formatRupiah(item.line_total)}
              </div>
            </IonItem>
          ))}
        </IonList>

        <IonList>
          <IonItem>
            <IonLabel>Subtotal</IonLabel>
            <div slot="end">{formatRupiah(transaction.subtotal)}</div>
          </IonItem>
          {transaction.discount_amount > 0 && (
            <IonItem>
              <IonLabel>Diskon</IonLabel>
              <div slot="end">- {formatRupiah(transaction.discount_amount)}</div>
            </IonItem>
          )}
          <IonItem>
            <IonLabel>
              <strong>Total</strong>
            </IonLabel>
            <strong slot="end">{formatRupiah(transaction.total)}</strong>
          </IonItem>
          <IonItem>
            <IonLabel>Dibayar</IonLabel>
            <div slot="end">{formatRupiah(transaction.paid_amount)}</div>
          </IonItem>
          <IonItem>
            <IonLabel>Kembalian</IonLabel>
            <div slot="end">{formatRupiah(transaction.change_amount)}</div>
          </IonItem>
        </IonList>

        <IonButton expand="block" className="ion-margin-top" onClick={() => onPrint(transaction)}>
          <IonIcon slot="start" icon={printOutline} />
          Cetak struk
        </IonButton>
      </IonContent>
    </IonModal>
  );
};

export default TransactionDetailModal;
