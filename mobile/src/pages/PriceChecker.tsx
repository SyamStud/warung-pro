import { useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonNote,
  IonPage,
  IonSpinner,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import {
  addCircleOutline,
  alertCircleOutline,
  cartOutline,
  closeCircle,
  refreshOutline,
  scanOutline,
  searchOutline,
} from 'ionicons/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { categoriesApi } from '../api/categories';
import { productsApi } from '../api/products';
import ProductFormModal from '../components/ProductFormModal';
import ProductRow from '../components/ProductRow';
import ConnectionBanner from '../components/ConnectionBanner';
import LiveScanner from '../components/LiveScanner';
import PageHeader from '../components/PageHeader';
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
 * 4 · Cek Harga — a live in-app camera plus the search result card.
 *
 * Two ways to scan: the viewfinder streams the camera inside the app
 * (`LiveScanner`), and the **Pindai Barcode** button still opens the native
 * ML Kit camera. The search field sits above both.
 *
 * A barcode the catalog does not know is answered **in the page**, not with a
 * modal: the camera keeps running and `rearmKey` clears the scanner's memory,
 * so a misread costs one tap instead of a trip out of the screen.
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
  const [cameraOn, setCameraOn] = useState(true);
  const [miss, setMiss] = useState<{ code: string; reason: 'not-found' | 'offline' } | null>(null);
  const [rearmKey, setRearmKey] = useState(0);
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
      setMiss(null);
    } catch (error) {
      const notFound = error instanceof ApiError && error.code === 'NOT_FOUND';
      const offline = error instanceof ApiError && error.code === 'NETWORK_ERROR';

      if (notFound || offline) {
        // Fall back to a product that is still queued locally.
        const queued = overlay.created.find((product) => product.sku === code);
        if (queued) {
          setResult(queued);
          setMiss(null);
          return;
        }

        // Reported in the page: the camera keeps running, so the user can aim
        // again right away instead of being stuck behind a modal.
        setMiss({ code, reason: notFound ? 'not-found' : 'offline' });
        return;
      }
      showToast(error instanceof ApiError ? error.message : 'Gagal mencari produk.', 'danger');
    }
  };

  /** "Pindai ulang": forget the code we just reported and keep the camera live. */
  const scanAgain = () => {
    setMiss(null);
    setRearmKey((value) => value + 1);
  };

  const handleScan = async () => {
    // The in-app preview and the native ML Kit camera cannot hold the camera at
    // the same time, so let go of the stream first.
    const resumePreview = cameraOn;
    setCameraOn(false);
    setScanning(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 250));
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
      if (resumePreview) setCameraOn(true);
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
      <IonContent>
        <PageHeader title="Cek Harga" backHref="/tabs/home" actions={<SyncStatus />} />

        <ConnectionBanner />

        <div className="screen">
          {result === null ? (
            <>
              <div className="search" style={{ marginTop: 4 }}>
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

              <div className="or-split">
                <span>atau pindai barcode</span>
              </div>

              <LiveScanner
                active={cameraOn}
                rearmKey={rearmKey}
                onToggle={() => setCameraOn((value) => !value)}
                onDetected={(value) => {
                  setMiss(null);
                  void lookupCode(value);
                }}
              />

              {miss && (
                <div className="card miss" role="status">
                  <div className="miss__head">
                    <IonIcon icon={alertCircleOutline} />
                    <span>
                      {miss.reason === 'offline' ? 'Tidak ada koneksi' : 'Barcode belum terdaftar'}
                    </span>
                  </div>
                  <p className="miss__code">SKU {miss.code}</p>
                  <p className="miss__text">
                    {miss.reason === 'offline'
                      ? 'Produk tidak bisa dicari saat offline. Pindai ulang, atau tambahkan sebagai produk baru.'
                      : 'Pastikan seluruh barcode masuk ke dalam bingkai, lalu pindai ulang. Kalau kode ini memang belum terdaftar, tambahkan sebagai produk baru.'}
                  </p>
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ marginTop: 14 }}
                    onClick={() => openNewProduct(miss.code)}
                  >
                    <IonIcon icon={addCircleOutline} /> Tambah produk baru
                  </button>
                  <button
                    type="button"
                    className="btn btn--plain"
                    style={{ marginTop: 8 }}
                    onClick={scanAgain}
                  >
                    <IonIcon icon={refreshOutline} /> Pindai ulang
                  </button>
                </div>
              )}

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

              <p className="viewfinder__note">
                Membuka kamera penuh bawaan Google (ML Kit)
              </p>
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
                  style={{ width: 72, height: 72, fontSize: 25.2, margin: '0 auto 12px' }}
                  aria-hidden="true"
                >
                  {result.name.trim().charAt(0).toUpperCase() || '?'}
                </span>
                <h3 style={{ margin: '0 0 4px', fontSize: 16.2, fontWeight: 700 }}>{result.name}</h3>
                <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: 11.7 }}>
                  SKU: {result.sku}
                  {result.unit ? ` · ${result.unit}` : ''}
                </p>

                <p
                  style={{
                    margin: '16px 0 4px',
                    fontSize: 27,
                    fontWeight: 800,
                    color: 'var(--app-blue)',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {formatRupiah(result.selling_price)}
                </p>
                <p style={{ margin: 0, color: 'var(--app-muted)', fontSize: 11.7 }}>
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
          // The just-saved SKU may be the barcode still in front of the camera.
          scanAgain();
          showToast(message, color);
        }}
      />
    </IonPage>
  );
};

export default PriceChecker;
