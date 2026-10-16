import { useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { barcodeOutline, scanOutline } from 'ionicons/icons';
import { useQuery } from '@tanstack/react-query';
import { categoriesApi } from '../api/categories';
import { productsApi } from '../api/products';
import ProductDetailModal from '../components/ProductDetailModal';
import ProductFormModal from '../components/ProductFormModal';
import ConnectionBanner from '../components/ConnectionBanner';
import SyncStatus from '../components/SyncStatus';
import { formatRupiah } from '../lib/format';
import { ApiError } from '../lib/http';
import { categoryKeys, productKeys } from '../lib/queryKeys';
import { applyOverlay } from '../lib/offline/products';
import { useOutbox } from '../hooks/useOutbox';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { ScannerError, scannerService } from '../services/scanner';
import type { Product } from '../types';

const PriceChecker: React.FC = () => {
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  const { overlay } = useOutbox();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const [detail, setDetail] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formBarcode, setFormBarcode] = useState<string | undefined>(undefined);
  const [scanning, setScanning] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => categoriesApi.list(signal),
  });
  const categories = categoriesQuery.data?.data ?? [];

  const trimmedSearch = debouncedSearch.trim();
  const resultsQuery = useQuery({
    queryKey: productKeys.list({ search: trimmedSearch }),
    queryFn: ({ signal }) => productsApi.list({ search: trimmedSearch, per_page: 20 }, signal),
    enabled: trimmedSearch.length > 0,
  });
  const results = resultsQuery.data?.data ?? [];

  const showToast = (message: string, color: string = 'success') =>
    presentToast({ message, duration: 2000, color, position: 'top' });

  const matchesSearch = (product: Product) => {
    const query = trimmedSearch.toLowerCase();
    return (
      product.name.toLowerCase().includes(query) ||
      product.sku.toLowerCase().includes(query) ||
      (product.barcode ?? '').includes(query)
    );
  };
  // Include queued (offline) products that match the current search.
  const visibleResults = applyOverlay(results, overlay, matchesSearch);

  const openNewProduct = (barcode?: string) => {
    setEditing(null);
    setFormBarcode(barcode);
    setFormOpen(true);
  };

  const lookupBarcode = async (barcode: string) => {
    try {
      const { data } = await productsApi.lookup(barcode);
      setDetail(data);
    } catch (error) {
      const notFound = error instanceof ApiError && error.code === 'NOT_FOUND';
      const offline = error instanceof ApiError && error.code === 'NETWORK_ERROR';

      if (notFound || offline) {
        // Fall back to a product that is still queued locally.
        const queued = overlay.created.find((product) => product.barcode === barcode);
        if (queued) {
          setDetail(queued);
          return;
        }

        presentAlert({
          header: notFound ? 'Barcode tidak ditemukan' : 'Tidak ada koneksi',
          message: notFound
            ? `Barcode ${barcode} belum terdaftar. Tambahkan sebagai produk baru?`
            : 'Tidak dapat mencari barcode saat offline. Tambahkan sebagai produk baru?',
          buttons: [
            { text: 'Tutup', role: 'cancel' },
            { text: 'Tambah produk', handler: () => openNewProduct(barcode) },
          ],
        });
        return;
      }
      showToast(error instanceof ApiError ? error.message : 'Gagal mencari barcode.', 'danger');
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await scannerService.scan();
      if (result?.value) {
        await lookupBarcode(result.value);
      }
    } catch (error) {
      if (error instanceof ScannerError && error.reason !== 'failed') {
        presentAlert({ header: 'Kamera', message: error.message, buttons: ['OK'] });
      } else {
        showToast(error instanceof Error ? error.message : 'Pemindaian gagal.', 'danger');
      }
    } finally {
      setScanning(false);
    }
  };

  const looksLikeBarcode = /^\d{6,}$/.test(trimmedSearch);
  const searchError =
    resultsQuery.isError &&
    (resultsQuery.error instanceof ApiError ? resultsQuery.error.message : 'Gagal mencari produk.');

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Cek Harga</IonTitle>
          <IonButtons slot="end">
            <SyncStatus />
            <IonButton onClick={handleScan} disabled={scanning} aria-label="Pindai barcode">
              {scanning ? <IonSpinner name="dots" /> : <IonIcon slot="icon-only" icon={barcodeOutline} />}
            </IonButton>
          </IonButtons>
        </IonToolbar>
        <IonToolbar>
          <IonSearchbar
            value={search}
            onIonInput={(e) => setSearch(e.detail.value ?? '')}
            debounce={0}
            placeholder="Cari nama, SKU, atau barcode"
          />
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (event) => {
            await Promise.all([resultsQuery.refetch(), categoriesQuery.refetch()]);
            await event.detail.complete();
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <ConnectionBanner />

        {trimmedSearch === '' && (
          <div className="ion-padding ion-text-center">
            <IonIcon icon={scanOutline} style={{ fontSize: 64, color: 'var(--ion-color-medium)' }} />
            <p>Pindai barcode dengan kamera, atau cari produk berdasarkan nama, SKU, atau barcode.</p>
            <IonButton onClick={handleScan} disabled={scanning}>
              <IonIcon slot="start" icon={barcodeOutline} />
              Pindai Barcode
            </IonButton>
          </div>
        )}

        {trimmedSearch !== '' && resultsQuery.isLoading && (
          <div className="ion-padding ion-text-center">
            <IonSpinner name="crescent" />
          </div>
        )}

        {searchError && (
          <IonNote color="danger" className="ion-display-block ion-padding">
            {searchError}
          </IonNote>
        )}

        {trimmedSearch !== '' && !resultsQuery.isLoading && !searchError && visibleResults.length === 0 && (
          <div className="ion-padding">
            <IonNote color="medium" className="ion-display-block">
              Produk tidak ditemukan.
              {looksLikeBarcode && ' Barcode ini belum terdaftar.'}
            </IonNote>
            <IonButton
              className="ion-margin-top"
              expand="block"
              onClick={() => openNewProduct(looksLikeBarcode ? trimmedSearch : undefined)}
            >
              Tambah produk baru
            </IonButton>
          </div>
        )}

        {visibleResults.length > 0 && (
          <IonList>
            {visibleResults.map((product) => (
              <IonItem key={product.id} button onClick={() => setDetail(product)}>
                <IonLabel>
                  <h2>{product.name}</h2>
                  <p>
                    {product.sku}
                    {product.barcode ? ` · ${product.barcode}` : ''}
                  </p>
                </IonLabel>
                <div slot="end" style={{ textAlign: 'right', fontWeight: 600 }}>
                  {formatRupiah(product.selling_price)}
                </div>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>

      <ProductDetailModal
        isOpen={detail !== null}
        product={detail}
        categories={categories}
        onDismiss={() => setDetail(null)}
        onEdit={(product) => {
          setDetail(null);
          setEditing(product);
          setFormBarcode(undefined);
          setFormOpen(true);
        }}
        onArchived={(message) => {
          setDetail(null);
          showToast(message);
        }}
      />

      <ProductFormModal
        isOpen={formOpen}
        product={editing}
        initialBarcode={formBarcode}
        categories={categories}
        onDismiss={() => setFormOpen(false)}
        onSaved={(message, color) => {
          setFormOpen(false);
          showToast(message, color);
        }}
      />
    </IonPage>
  );
};

export default PriceChecker;
