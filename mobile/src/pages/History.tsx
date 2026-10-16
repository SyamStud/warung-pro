import { useState } from 'react';
import {
  IonBadge,
  IonContent,
  IonHeader,
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
  useIonAlert,
} from '@ionic/react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { transactionsApi } from '../api/transactions';
import ConnectionBanner from '../components/ConnectionBanner';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { formatDateTime, formatRupiah } from '../lib/format';
import { ApiError } from '../lib/http';
import { transactionKeys } from '../lib/queryKeys';
import type { Transaction } from '../types';

const PAGE_SIZE = 20;

/** History — transaction list and detail. Receipt printing arrives in Phase 6. */
const History: React.FC = () => {
  const [presentAlert] = useIonAlert();
  const [detail, setDetail] = useState<Transaction | null>(null);

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

  const printReceipt = (transaction: Transaction) => {
    presentAlert({
      header: 'Cetak struk',
      message: `Struk ${transaction.transaction_number} akan dapat dicetak setelah integrasi printer thermal (Phase 6).`,
      buttons: ['OK'],
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Riwayat</IonTitle>
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
        onPrint={printReceipt}
      />
    </IonPage>
  );
};

export default History;
