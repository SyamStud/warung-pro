import { useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
} from '@ionic/react';
import { closeCircle, printOutline, receiptOutline, searchOutline } from 'ionicons/icons';
import { useInfiniteQuery } from '@tanstack/react-query';
import { transactionsApi } from '../api/transactions';
import ConnectionBanner from '../components/ConnectionBanner';
import PageHeader from '../components/PageHeader';
import PrinterSettingsModal from '../components/PrinterSettingsModal';
import ReceiptPreviewModal from '../components/ReceiptPreviewModal';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { formatDateTime, formatRupiah } from '../lib/format';
import { ApiError } from '../lib/http';
import { transactionKeys } from '../lib/queryKeys';
import { useReceiptPrinter } from '../hooks/useReceiptPrinter';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { paymentMethodBadge, paymentMethodLabel, type PaymentMethod, type Transaction } from '../types';

const PAGE_SIZE = 20;

const METHOD_FILTERS: { value: PaymentMethod | 'all'; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'cash', label: 'Tunai' },
  { value: 'non_cash', label: 'Non Tunai' },
];

/** 11 · Riwayat Transaksi — search, payment-method chips, and reprint. */
const History: React.FC = () => {
  const [detail, setDetail] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  const [method, setMethod] = useState<PaymentMethod | 'all'>('all');
  const debouncedSearch = useDebouncedValue(search, 300);
  const printer = useReceiptPrinter();

  const filters = {
    search: debouncedSearch.trim() || undefined,
    payment_method: method,
  };

  const query = useInfiniteQuery({
    queryKey: transactionKeys.list(filters),
    queryFn: ({ pageParam, signal }) =>
      transactionsApi.list({ ...filters, page: pageParam, per_page: PAGE_SIZE }, signal),
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
      <IonContent>
        <PageHeader
          title="Riwayat Transaksi"
          actions={
            <button
              type="button"
              className="btn btn--icon"
              aria-label="Pengaturan printer"
              onClick={printer.openSettings}
            >
              <IonIcon icon={printOutline} />
            </button>
          }
        />

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

        <div className="screen">
          <div className="search">
            <IonIcon className="search__icon" icon={searchOutline} aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor transaksi"
              aria-label="Cari nomor transaksi"
            />
            {search !== '' && (
              <button
                type="button"
                className="search__clear"
                aria-label="Hapus pencarian"
                onClick={() => setSearch('')}
              >
                <IonIcon icon={closeCircle} />
              </button>
            )}
          </div>

          <div className="chip-row" style={{ marginTop: 12 }}>
            {METHOD_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={`chip${method === filter.value ? ' chip--active' : ''}`}
                onClick={() => setMethod(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="section-head">
            <h2 className="section-head__title">
              {transactions.length > 0 ? `${transactions.length} transaksi` : 'Transaksi'}
            </h2>
          </div>

          {query.isLoading && (
            <div className="spinner-center">
              <IonSpinner name="crescent" />
            </div>
          )}

          {error && <IonNote className="note note--error">{error}</IonNote>}

          {!query.isLoading && !error && transactions.length === 0 && (
            <div className="card empty-state">
              <IonIcon className="empty-state__icon" icon={receiptOutline} />
              <p className="empty-state__title">Belum ada transaksi</p>
              <p className="empty-state__text">Transaksi dari POS akan tampil di sini.</p>
            </div>
          )}

          <div className="list-stack">
            {transactions.map((transaction) => (
              <button
                key={transaction.id}
                type="button"
                className="product-row"
                onClick={() => setDetail(transaction)}
              >
                <span className="thumb" aria-hidden="true">
                  <IonIcon icon={receiptOutline} />
                </span>

                <span className="product-row__main">
                  <span className="product-row__name">{transaction.transaction_number}</span>
                  <span className="product-row__sku">
                    {formatDateTime(transaction.created_at)} · {transaction.items?.length ?? 0} item
                  </span>
                </span>

                <span className="product-row__aside">
                  <span className="product-row__price">{formatRupiah(transaction.total)}</span>
                  {transaction.status !== 'paid' && (
                    <span className="badge badge--grey">Dibatalkan</span>
                  )}
                  <span className={`badge ${paymentMethodBadge(transaction.payment_method)}`}>
                    {paymentMethodLabel(transaction.payment_method)}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <IonInfiniteScroll
            disabled={!query.hasNextPage}
            onIonInfinite={async (event) => {
              await query.fetchNextPage();
              await event.target.complete();
            }}
          >
            <IonInfiniteScrollContent loadingText="Memuat lagi..." />
          </IonInfiniteScroll>
        </div>
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
