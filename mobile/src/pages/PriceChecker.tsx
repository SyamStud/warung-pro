import { useState } from 'react';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonNote,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import {
  addCircleOutline,
  cartOutline,
  closeCircle,
  refreshOutline,
  scanOutline,
  searchOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { categoriesApi } from '../api/categories';
import { productsApi } from '../api/products';
import ProductFormModal from '../components/ProductFormModal';
import ProductRow from '../components/ProductRow';
import ConnectionBanner from '../components/ConnectionBanner';
import SyncStatus from '../components/SyncStatus';
import { useCart } from '../cart/useCart';
import { formatRupiah } from '../lib/format';
import { ApiError } from '../lib/http';
import { categoryKeys, productKeys } from '../lib/queryKeys';
import { applyOverlay } from '../lib/offline/products';
import { useOutbox } from '../hooks/useOutbox';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { ScannerError, scannerService } from '../services/scanner';
import type { Product } from '../types';

/**
 * 4 · Cek Harga — camera viewfinder plus the search result card.
 *
 * The live preview is a styled placeholder: `@capacitor-mlkit/barcode-scanning`
 * opens its own native fullscreen camera, so tapping the viewfinder launches
 * that UI. On the web the scanner reports `unsupported`.
 */
const PriceChecker: React.FC = () => {
  const navigate = useNavigate();
  const cart = useCart();
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();
  const { overlay } = useOutbox();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const trimmedSearch = debouncedSearch.trim();

  const [result, setResult] = useState<Product | null>(null);
  const [scanning, setScanning] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formSku, setFormSku] = useState<string | undefined>(undefined);

  const categoriesQuery = useQuery({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => categoriesApi.list(signal),
  });
  const categories = categoriesQuery.data?.data ?? [];

  const resultsQuery = useQuery({
    queryKey: productKeys.list({ search: trimmedSearch }),
    queryFn: ({ signal }) => productsApi.list({ search: trimmedSearch, per_page: 20 }, signal),
    enabled: trimmedSearch.length > 0 && result === null,
  });

  const results = resultsQuery.data?.data ?? [];

  const matchesSearch = (product: Product) => {
    const query = trimmedSearch.toLowerCase();
    return product.name.toLowerCase().includes(query) || product.sku.toLowerCase().includes(query);
  };
  // Include queued (offline) products that match the current search.
  const visibleResults = applyOverlay(results, overlay, matchesSearch);

  const showToast = (message: string, color: string = 'success') =>
    presentToast({ message, duration: 2000, color, position: 'top' });

  const openNewProduct = (sku?: string) => {
    setFormSku(sku);
    setFormOpen(true);
  };

  const lookupCode = async (code: string) => {
    try {
      const { data } = await productsApi.lookup(code);
      setResult(data);
      setSearch('');
    } catch (error) {
      const notFound = error instanceof ApiError && error.code === 'NOT_FOUND';
      const offline = error instanceof ApiError && error.code === 'NETWORK_ERROR';

      if (notFound || offline) {
        // Fall back to a product that is still queued locally.
        const queued = overlay.created.find((product) => product.sku === code);
        if (queued) {
          setResult(queued);
          return;
        }

        presentAlert({
          header: notFound ? 'Kode tidak ditemukan' : 'Tidak ada koneksi',
          message: notFound
            ? `SKU ${code} belum terdaftar. Tambahkan sebagai produk baru?`
            : 'Tidak dapat mencari produk saat offline. Tambahkan sebagai produk baru?',
          buttons: [
            { text: 'Tutup', role: 'cancel' },
            { text: 'Tambah produk', handler: () => openNewProduct(code) },
          ],
        });
        return;
      }
      showToast(error instanceof ApiError ? error.message : 'Gagal mencari produk.', 'danger');
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const scanned = await scannerService.scan();
      if (scanned?.value) {
        await lookupCode(scanned.value);
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

  const addToCart = (product: Product) => {
    if (!cart.add(product)) {
      showToast('Produk ini belum tersinkron, tunggu hingga tersimpan.', 'warning');
      return;
    }
    showToast(`${product.name} masuk keranjang.`);
    navigate('/tabs/pos');
  };

  const looksLikeCode = /^\d{6,}$/.test(trimmedSearch);
  const searchError =
    resultsQuery.isError &&
    (resultsQuery.error instanceof ApiError ? resultsQuery.error.message : 'Gagal mencari produk.');

  return (
    <IonPage>
      <IonHeader className="app-header">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/home" text="" />
          </IonButtons>
          <IonTitle className="app-title-bar">Cek Harga</IonTitle>
          <IonButtons slot="end">
            <SyncStatus />
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <ConnectionBanner />

        <div className="screen">
          {result === null ? (
            <>
              <div className="viewfinder">
                <span className="badge badge--blue viewfinder__badge">
                  <IonIcon icon={sparklesOutline} /> Mode pindai
                </span>
                <div className="viewfinder__frame">
                  <span className="viewfinder__laser" />
                </div>
              </div>

              <p
                style={{
                  textAlign: 'center',
                  color: 'var(--app-muted)',
                  fontSize: 13,
                  margin: '12px 0 14px',
                }}
              >
                Arahkan kamera ke barcode produk
              </p>

              <button
                type="button"
                className="btn btn--primary"
                style={{ marginTop: 0 }}
                disabled={scanning}
                onClick={handleScan}
              >
                {scanning ? <IonSpinner name="dots" /> : <IonIcon icon={scanOutline} />}
                {scanning ? 'Memindai...' : 'Pindai Barcode'}
              </button>

              <p style={{ textAlign: 'center', color: 'var(--app-muted)', fontSize: 13, margin: '10px 0 18px' }}>
                atau cari produk berdasarkan nama / SKU
              </p>

              <div className="search">
                <IonIcon className="search__icon" icon={searchOutline} aria-hidden="true" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Ketik nama atau SKU produk"
                  aria-label="Cari produk"
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

              {trimmedSearch !== '' && resultsQuery.isLoading && (
                <div className="spinner-center">
                  <IonSpinner name="crescent" />
                </div>
              )}

              {searchError && <IonNote className="note note--error">{searchError}</IonNote>}

              {trimmedSearch !== '' &&
                !resultsQuery.isLoading &&
                !searchError &&
                visibleResults.length === 0 && (
                  <div className="card empty-state" style={{ marginTop: 16 }}>
                    <p className="empty-state__title">Produk tidak ditemukan</p>
                    <p className="empty-state__text">
                      {looksLikeCode
                        ? 'Kode ini belum terdaftar di katalog.'
                        : 'Coba kata kunci lain atau tambahkan produk baru.'}
                    </p>
                    <button
                      type="button"
                      className="btn btn--outline"
                      style={{ marginTop: 14 }}
                      onClick={() => openNewProduct(looksLikeCode ? trimmedSearch : undefined)}
                    >
                      <IonIcon icon={addCircleOutline} /> Tambah produk baru
                    </button>
                  </div>
                )}

              {visibleResults.length > 0 && (
                <div className="list-stack" style={{ marginTop: 14 }}>
                  {visibleResults.map((product) => (
                    <ProductRow key={product.id} product={product} onClick={() => setResult(product)} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="section-head" style={{ marginTop: 4 }}>
                <h2 className="section-head__title">Hasil Pencarian</h2>
                <button type="button" className="link" onClick={() => setResult(null)}>
                  <IonIcon icon={refreshOutline} /> Cek lagi
                </button>
              </div>

              <div className="card" style={{ textAlign: 'center' }}>
                <span
                  className="thumb"
                  style={{ width: 72, height: 72, fontSize: 28, margin: '0 auto 12px' }}
                  aria-hidden="true"
                >
                  {result.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>{result.name}</h3>
                <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: 13 }}>
                  SKU: {result.sku}
                  {result.unit ? ` · ${result.unit}` : ''}
                </p>

                <p
                  style={{
                    margin: '16px 0 4px',
                    fontSize: 30,
                    fontWeight: 800,
                    color: 'var(--app-blue)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {formatRupiah(result.selling_price)}
                </p>
                <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: 13 }}>
                  Harga jual per {result.unit || 'satuan'}
                </p>

                {result.id < 0 && (
                  <p className="badge badge--amber" style={{ marginTop: 12 }}>
                    Belum tersinkron
                  </p>
                )}
                {!result.is_active && (
                  <p className="badge badge--grey" style={{ marginTop: 12 }}>
                    Produk diarsipkan
                  </p>
                )}

                <button
                  type="button"
                  className="btn btn--primary"
                  style={{ marginTop: 20 }}
                  disabled={result.id < 0 || !result.is_active}
                  onClick={() => addToCart(result)}
                >
                  <IonIcon icon={cartOutline} /> Tambahkan ke Keranjang
                </button>

                <button
                  type="button"
                  className="btn btn--plain"
                  style={{ marginTop: 10 }}
                  onClick={() => navigate('/tabs/products')}
                >
                  Lihat di Katalog
                </button>
              </div>
            </>
          )}
        </div>
      </IonContent>

      <ProductFormModal
        isOpen={formOpen}
        product={null}
        initialSku={formSku}
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
