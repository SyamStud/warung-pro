import { useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { printOutline } from 'ionicons/icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { transactionsApi } from '../api/transactions';
import ConnectionBanner from '../components/ConnectionBanner';
import PrinterSettingsModal from '../components/PrinterSettingsModal';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { formatDateTime, formatRupiah } from '../lib/format';
import { ApiError } from '../lib/http';
import { transactionKeys } from '../lib/queryKeys';
import { useReceiptPrinter } from '../hooks/useReceiptPrinter';
import type { Transaction } from '../types';

const PAGE_SIZE = 20;

/** History — transaction list, detail, and receipt printing. */
const History: React.FC = () => {
  const [detail, setDetail] = useState<Transaction | null>(null);
  const printer = useReceiptPrinter();

  const query = useInfiniteQuery({
    queryKey: transactionKeys.list(),
    queryFn: ({ pageParam, signal }) =>
      transactionsApi.list({ page: pageParam, per_page: PAGE_SIZE }, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.current_page < lastPage.meta.last_page
        ? lastPage.meta.current_page + 1
        : undefined,
  });

  const transactions = query.data?.pages.flatMap((page) => page.data) ?? [];
  const error =
    query.isError &&
    (query.error instanceof ApiError ? query.error.message : 'Gagal memuat riwayat transaksi.');

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Riwayat</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={printer.openSettings} aria-label="Pengaturan printer">
              <IonIcon slot="icon-only" icon={printOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (event) => {
            await query.refetch();
            await event.detail.complete();
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <ConnectionBanner />

        {query.isLoading && (
          <div className="ion-padding ion-text-center">
            <IonSpinner name="crescent" />
          </div>
        )}

        {error && (
          <IonNote color="danger" className="ion-display-block ion-padding">
            {error}
          </IonNote>
        )}

        {!query.isLoading && !error && transactions.length === 0 && (
          <IonNote color="medium" className="ion-display-block ion-padding">
            Belum ada transaksi. Transaksi dari tab Kasir akan tampil di sini.
          </IonNote>
        )}

        <IonList>
          {transactions.map((transaction) => (
            <IonItem key={transaction.id} button onClick={() => setDetail(transaction)}>
              <IonLabel>
                <h2>{transaction.transaction_number}</h2>
                <p>
                  {formatDateTime(transaction.created_at)} · {transaction.items?.length ?? 0} item
                </p>
              </IonLabel>
              <div slot="end" style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 600 }}>{formatRupiah(transaction.total)}</div>
                <IonBadge color={transaction.status === 'paid' ? 'success' : 'medium'}>
                  {transaction.status === 'paid' ? 'Lunas' : 'Dibatalkan'}
                </IonBadge>
              </div>
            </IonItem>
          ))}
        </IonList>

        <IonInfiniteScroll
          disabled={!query.hasNextPage}
          onIonInfinite={async (event) => {
            await query.fetchNextPage();
            await event.target.complete();
          }}
        >
          <IonInfiniteScrollContent loadingText="Memuat lagi..." />
        </IonInfiniteScroll>
      </IonContent>

      <TransactionDetailModal
        isOpen={detail !== null}
        transaction={detail}
        onDismiss={() => setDetail(null)}
        onPrint={printer.print}
      />

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

export default History;
