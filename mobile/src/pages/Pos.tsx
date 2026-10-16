import { useEffect, useMemo, useRef, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { addOutline, barcodeOutline, closeOutline, removeOutline } from 'ionicons/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../api/categories';
import { productsApi } from '../api/products';
import { transactionsApi } from '../api/transactions';
import ConnectionBanner from '../components/ConnectionBanner';
import ProductFormModal from '../components/ProductFormModal';
import { formatRupiah } from '../lib/format';
import { ApiError } from '../lib/http';
import { categoryKeys, productKeys, transactionKeys } from '../lib/queryKeys';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { ScannerError, scannerService } from '../services/scanner';
import {
  addProductToCart,
  changeLineQuantity,
  computeTotals,
  removeLine as removeLineFromCart,
  type CartLine,
} from '../lib/cart';
import type { Product } from '../types';

function uuid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `trx-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/** POS — cart, quantity, payment, and server-authoritative checkout. */
const Pos: React.FC = () => {
  const queryClient = useQueryClient();
  const [presentToast] = useIonToast();
  const [presentAlert] = useIonAlert();
  const online = useOnlineStatus();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const trimmedSearch = debouncedSearch.trim();

  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState('');
  const [paid, setPaid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [formBarcode, setFormBarcode] = useState<string | undefined>(undefined);

  // Reuse one idempotency key per cart contents so a retried checkout does not
  // create two transactions; a changed cart starts a new key.
  const checkoutKey = useRef(uuid());
  useEffect(() => {
    checkoutKey.current = uuid();
  }, [cart, discount]);

  const categoriesQuery = useQuery({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => categoriesApi.list(signal),
  });
  const categories = categoriesQuery.data?.data ?? [];

  const resultsQuery = useQuery({
    queryKey: productKeys.list({ search: trimmedSearch }),
    queryFn: ({ signal }) => productsApi.list({ search: trimmedSearch, per_page: 20 }, signal),
    enabled: trimmedSearch.length > 0,
  });
  const results = resultsQuery.data?.data ?? [];

  const showToast = (message: string, color: string = 'success') =>
    presentToast({ message, duration: 2000, color, position: 'top' });

  const addToCart = (product: Product) => {
    if (product.id < 0) {
      showToast('Produk ini belum tersinkron, tunggu hingga tersimpan.', 'warning');
      return;
    }

    setCart((lines) => addProductToCart(lines, product));
  };

  const changeQuantity = (id: number, delta: number) => {
    setCart((lines) => changeLineQuantity(lines, id, delta));
  };

  const removeLine = (id: number) => {
    setCart((lines) => removeLineFromCart(lines, id));
  };

  const clearCart = () => {
    setCart([]);
    setDiscount('');
    setPaid('');
  };

  const { subtotal, discountAmount, total, paidAmount, changeAmount } = useMemo(
    () => computeTotals(cart, Number(discount) || 0, Number(paid) || 0),
    [cart, discount, paid],
  );
  const canPay = online && cart.length > 0 && total >= 0 && paidAmount >= total && !submitting;

  const checkout = async () => {
    if (!online) {
      presentAlert({
        header: 'Tidak ada koneksi',
        message: 'Transaksi memerlukan koneksi ke server. Coba lagi saat online.',
        buttons: ['OK'],
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await transactionsApi.create(
        {
          items: cart.map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
          discount_amount: discountAmount,
          paid_amount: paidAmount,
        },
        checkoutKey.current,
      );

      await queryClient.invalidateQueries({ queryKey: transactionKeys.all });

      presentAlert({
        header: 'Transaksi tersimpan',
        subHeader: data.transaction_number,
        message:
          `Total ${formatRupiah(data.total)}\n` +
          `Dibayar ${formatRupiah(data.paid_amount)}\n` +
          `Kembalian ${formatRupiah(data.change_amount)}`,
        buttons: ['Selesai'],
      });

      clearCart();
      setSearch('');
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.details
            ? Object.values(error.details).flat().join(' ')
            : error.message
          : 'Gagal menyimpan transaksi.';
      presentAlert({ header: 'Transaksi gagal', message, buttons: ['OK'] });
    } finally {
      setSubmitting(false);
    }
  };

  const openNewProduct = (barcode?: string) => {
    setFormBarcode(barcode);
    setFormOpen(true);
  };

  const handleScan = async () => {
    setScanning(true);
    let barcode: string | undefined;
    try {
      const result = await scannerService.scan();
      barcode = result?.value;
      if (!barcode) return;

      const { data } = await productsApi.lookup(barcode);
      addToCart(data);
      showToast(`${data.name} ditambahkan ke keranjang.`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_FOUND') {
        presentAlert({
          header: 'Barcode tidak ditemukan',
          message: `Barcode ${barcode} belum terdaftar. Tambahkan sebagai produk baru?`,
          buttons: [
            { text: 'Tutup', role: 'cancel' },
            { text: 'Tambah produk', handler: () => openNewProduct(barcode) },
          ],
        });
      } else if (error instanceof ScannerError && error.reason !== 'failed') {
        presentAlert({ header: 'Kamera', message: error.message, buttons: ['OK'] });
      } else {
        showToast(error instanceof Error ? error.message : 'Pemindaian gagal.', 'danger');
      }
    } finally {
      setScanning(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Kasir</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleScan} disabled={scanning} aria-label="Pindai barcode">
              {scanning ? (
                <IonSpinner name="dots" />
              ) : (
                <IonIcon slot="icon-only" icon={barcodeOutline} />
              )}
            </IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={search}
            onIonInput={(e) => setSearch(e.detail.value ?? '')}
            debounce={0}
            placeholder="Cari produk untuk ditambahkan"
          />
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <ConnectionBanner />

        {trimmedSearch !== '' && (
          <IonList>
            <IonListHeader>
              <IonLabel>Hasil pencarian</IonLabel>
            </IonListHeader>

            {resultsQuery.isLoading && (
              <div className="ion-padding ion-text-center">
                <IonSpinner name="crescent" />
              </div>
            )}

            {!resultsQuery.isLoading && !resultsQuery.isError && results.length === 0 && (
              <IonItem>
                <IonNote color="medium">Produk tidak ditemukan.</IonNote>
              </IonItem>
            )}

            {results.map((product) => (
              <IonItem key={product.id} button onClick={() => addToCart(product)}>
                <IonLabel>
                  <h2>{product.name}</h2>
                  <p>
                    {product.sku}
                    {product.barcode ? ` · ${product.barcode}` : ''}
                  </p>
                </IonLabel>
                <div slot="end" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>{formatRupiah(product.selling_price)}</span>
                  <IonIcon icon={addOutline} color="primary" />
                </div>
              </IonItem>
            ))}
          </IonList>
        )}

        {cart.length > 0 ? (
          <IonList>
            <IonListHeader>
              <IonLabel>Keranjang ({cart.length})</IonLabel>
              <IonButton fill="clear" size="small" onClick={clearCart}>
                Kosongkan
              </IonButton>
            </IonListHeader>

            {cart.map((line) => (
              <IonItem key={line.product.id}>
                <IonLabel>
                  <h2>{line.product.name}</h2>
                  <p>
                    {formatRupiah(line.product.selling_price)} / {line.product.unit}
                  </p>
                </IonLabel>
                <div slot="end" style={{ display: 'flex', alignItems: 'center' }}>
                  <IonButton
                    fill="clear"
                    size="small"
                    aria-label="Kurangi"
                    onClick={() => changeQuantity(line.product.id, -1)}
                  >
                    <IonIcon slot="icon-only" icon={removeOutline} />
                  </IonButton>
                  <span style={{ minWidth: 24, textAlign: 'center' }}>{line.quantity}</span>
                  <IonButton
                    fill="clear"
                    size="small"
                    aria-label="Tambah"
                    onClick={() => changeQuantity(line.product.id, 1)}
                  >
                    <IonIcon slot="icon-only" icon={addOutline} />
                  </IonButton>
                  <strong style={{ minWidth: 84, textAlign: 'right' }}>
                    {formatRupiah(line.product.selling_price * line.quantity)}
                  </strong>
                  <IonButton
                    fill="clear"
                    size="small"
                    color="danger"
                    aria-label="Hapus"
                    onClick={() => removeLine(line.product.id)}
                  >
                    <IonIcon slot="icon-only" icon={closeOutline} />
                  </IonButton>
                </div>
              </IonItem>
            ))}
          </IonList>
        ) : (
          trimmedSearch === '' && (
            <div className="ion-padding ion-text-center">
              <p style={{ color: 'var(--ion-color-medium)' }}>
                Cari produk atau pindai barcode untuk mulai transaksi.
              </p>
            </div>
          )
        )}
      </IonContent>

      <IonFooter>
        <IonToolbar>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
            <span>Subtotal</span>
            <span>{formatRupiah(subtotal)}</span>
          </div>
        </IonToolbar>

        <IonToolbar>
          <IonItem lines="none">
            <IonInput
              type="number"
              inputmode="numeric"
              label="Diskon (Rp)"
              labelPlacement="stacked"
              value={discount}
              onIonInput={(e) => setDiscount(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem lines="none">
            <IonInput
              type="number"
              inputmode="numeric"
              label="Dibayar (Rp)"
              labelPlacement="stacked"
              value={paid}
              onIonInput={(e) => setPaid(e.detail.value ?? '')}
            />
            <IonButton slot="end" fill="clear" size="small" onClick={() => setPaid(String(total))}>
              Uang pas
            </IonButton>
          </IonItem>
        </IonToolbar>

        <IonToolbar>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 16px',
              fontWeight: 600,
            }}
          >
            <span>Total</span>
            <span>{formatRupiah(Math.max(total, 0))}</span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 16px',
              color: 'var(--ion-color-medium)',
            }}
          >
            <span>Kembalian</span>
            <span>{formatRupiah(Math.max(changeAmount, 0))}</span>
          </div>
        </IonToolbar>

        <IonToolbar>
          {!online && (
            <IonNote
              color="warning"
              className="ion-display-block ion-padding-horizontal ion-padding-bottom"
            >
              Transaksi memerlukan koneksi ke server.
            </IonNote>
          )}
          <IonButton expand="block" className="ion-margin-horizontal" disabled={!canPay} onClick={checkout}>
            {submitting ? <IonSpinner name="dots" /> : `Bayar ${formatRupiah(Math.max(total, 0))}`}
          </IonButton>
        </IonToolbar>
      </IonFooter>

      <ProductFormModal
        isOpen={formOpen}
        product={null}
        initialBarcode={formBarcode}
        categories={categories}
        onDismiss={() => setFormOpen(false)}
        onSaved={(message) => {
          setFormOpen(false);
          showToast(message);
          void queryClient.invalidateQueries({ queryKey: productKeys.all });
        }}
      />
    </IonPage>
  );
};

export default Pos;
