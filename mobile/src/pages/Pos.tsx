import { useState } from 'react';
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
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
  closeOutline,
  printOutline,
  scanOutline,
  searchOutline,
} from 'ionicons/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { categoriesApi } from '../api/categories';
import { productsApi } from '../api/products';
import ConnectionBanner from '../components/ConnectionBanner';
import PrinterSettingsModal from '../components/PrinterSettingsModal';
import ProductFormModal from '../components/ProductFormModal';
import ProductRow from '../components/ProductRow';
import { useCart } from '../cart/useCart';
import { useReceiptPrinter } from '../hooks/useReceiptPrinter';
import { formatRupiah } from '../lib/format';
import { ApiError } from '../lib/http';
import { categoryKeys, productKeys } from '../lib/queryKeys';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import { ScannerError, scannerService } from '../services/scanner';
import type { Product } from '../types';

/** 8 · POS — build the cart, then continue to Pembayaran to pay. */
const Pos: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = useCart();
  const printer = useReceiptPrinter();
  const [presentToast] = useIonToast();
  const [presentAlert] = useIonAlert();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const trimmedSearch = debouncedSearch.trim();

  const [scanning, setScanning] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formSku, setFormSku] = useState<string | undefined>(undefined);

  const categoriesQuery = useQuery({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => categoriesApi.list(signal),
    enabled: formOpen,
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
    if (!cart.add(product)) {
      showToast('Produk ini belum tersinkron, tunggu hingga tersimpan.', 'warning');
      return;
    }
    showToast(`${product.name} ditambahkan.`);
  };

  const openNewProduct = (sku?: string) => {
    setFormSku(sku);
    setFormOpen(true);
  };

  const handleScan = async () => {
    setScanning(true);
    let code: string | undefined;
    try {
      const scanned = await scannerService.scan();
      code = scanned?.value;
      if (!code) return;

      const { data } = await productsApi.lookup(code);
      addToCart(data);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'NOT_FOUND') {
        presentAlert({
          header: 'Kode tidak ditemukan',
          message: 'SKU ini belum terdaftar. Tambahkan sebagai produk baru?',
          buttons: [
            { text: 'Tutup', role: 'cancel' },
            { text: 'Tambah produk', handler: () => openNewProduct(code) },
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
      <IonHeader className="app-header">
        <IonToolbar>
          <IonTitle className="app-title-bar">POS</IonTitle>
          <IonButtons slot="end">
            <button
              type="button"
              className="btn btn--icon"
              aria-label="Pengaturan printer"
              onClick={printer.openSettings}
            >
              <IonIcon icon={printOutline} />
            </button>
            <button
              type="button"
              className="btn btn--icon"
              aria-label="Pindai barcode"
              disabled={scanning}
              onClick={handleScan}
            >
              {scanning ? <IonSpinner name="dots" /> : <IonIcon icon={scanOutline} />}
            </button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <ConnectionBanner />

        <div className="screen">
          <div className="search">
            <IonIcon className="search__icon" icon={searchOutline} aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari produk atau SKU"
              aria-label="Cari produk untuk keranjang"
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

          {trimmedSearch !== '' && (
            <>
              <div className="section-head">
                <h2 className="section-head__title">Hasil pencarian</h2>
              </div>

              {resultsQuery.isLoading && (
                <div className="spinner-center">
                  <IonSpinner name="crescent" />
                </div>
              )}

              {!resultsQuery.isLoading && results.length === 0 && (
                <div className="card empty-state">
                  <p className="empty-state__title">Produk tidak ditemukan</p>
                  <p className="empty-state__text">Periksa ejaan, atau tambahkan produk baru.</p>
                  <button
                    type="button"
                    className="btn btn--outline"
                    style={{ marginTop: 14 }}
                    onClick={() => openNewProduct(trimmedSearch)}
                  >
                    <IonIcon icon={addCircleOutline} /> Tambah produk baru
                  </button>
                </div>
              )}

              <div className="list-stack">
                {results.map((product) => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    onClick={() => addToCart(product)}
                    aside={
                      <span className="product-row__aside">
                        <span className="product-row__price">
                          {formatRupiah(product.selling_price)}
                        </span>
                        <IonIcon
                          icon={addCircleOutline}
                          style={{ color: 'var(--app-blue)', fontSize: 22 }}
                        />
                      </span>
                    }
                  />
                ))}
              </div>
            </>
          )}

          <div className="section-head">
            <h2 className="section-head__title">Keranjang ({cart.itemCount})</h2>
            {cart.lines.length > 0 && (
              <button type="button" className="link" onClick={cart.clear}>
                Kosongkan
              </button>
            )}
          </div>

          {cart.lines.length === 0 ? (
            <div className="card empty-state">
              <IonIcon className="empty-state__icon" icon={cartOutline} />
              <p className="empty-state__title">Keranjang masih kosong</p>
              <p className="empty-state__text">
                Cari produk di atas atau pindai barcode untuk mulai transaksi.
              </p>
            </div>
          ) : (
            <div className="list-stack">
              {cart.lines.map((line) => (
                <div key={line.product.id} className="product-row">
                  <span className="thumb" aria-hidden="true">
                    {line.product.name.trim().charAt(0).toUpperCase() || '?'}
                  </span>

                  <span className="product-row__main">
                    <span className="product-row__name">{line.product.name}</span>
                    <span className="product-row__sku">
                      {formatRupiah(line.product.selling_price)} / {line.product.unit}
                    </span>
                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        marginTop: 8,
                      }}
                    >
                      <span className="stepper">
                        <button
                          type="button"
                          className="stepper__btn"
                          aria-label={`Kurangi ${line.product.name}`}
                          onClick={() => cart.changeQuantity(line.product.id, -1)}
                        >
                          −
                        </button>
                        <span className="stepper__value">{line.quantity}</span>
                        <button
                          type="button"
                          className="stepper__btn"
                          aria-label={`Tambah ${line.product.name}`}
                          onClick={() => cart.changeQuantity(line.product.id, 1)}
                        >
                          +
                        </button>
                      </span>
                      <button
                        type="button"
                        className="link"
                        style={{ color: 'var(--app-red)' }}
                        onClick={() => cart.remove(line.product.id)}
                      >
                        <IonIcon icon={closeOutline} /> Hapus
                      </button>
                    </span>
                  </span>

                  <span className="product-row__aside">
                    <span className="product-row__price">
                      {formatRupiah(line.product.selling_price * line.quantity)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {cart.lines.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <div className="totals">
                <div className="totals__row">
                  <span>Subtotal</span>
                  <span className="totals__value">{formatRupiah(cart.totals.subtotal)}</span>
                </div>
              </div>

              <button
                type="button"
                className="btn btn--primary"
                style={{ marginTop: 14 }}
                onClick={() => navigate('/tabs/payment')}
              >
                Lanjut ke Pembayaran
              </button>
            </div>
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
          void queryClient.invalidateQueries({ queryKey: productKeys.all });
        }}
      />

      <PrinterSettingsModal isOpen={printer.settingsOpen} onDismiss={printer.closeSettings} />
    </IonPage>
  );
};

export default Pos;
