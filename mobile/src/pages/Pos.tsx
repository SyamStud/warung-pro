import { useEffect, useRef, useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonPage,
  IonSpinner,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import {
  addCircleOutline,
  addOutline,
  cartOutline,
  closeCircle,
  printOutline,
  removeOutline,
  scanOutline,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { categoriesApi } from '../api/categories';
import { productsApi } from '../api/products';
import ConnectionBanner from '../components/ConnectionBanner';
import PageHeader from '../components/PageHeader';
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

  /** Results float over the cart until dismissed or a product is picked. */
  const [resultsOpen, setResultsOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

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

  /** Pick a result: add it, then reset the field for the next item. */
  const selectResult = (product: Product) => {
    addToCart(product);
    setSearch('');
    setResultsOpen(false);
  };

  // Tap outside the search field to dismiss the popup.
  useEffect(() => {
    if (!resultsOpen) return;

    const dismiss = (event: PointerEvent) => {
      if (!searchWrapRef.current?.contains(event.target as Node)) {
        setResultsOpen(false);
      }
    };

    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [resultsOpen]);

  const openNewProduct = (sku?: string) => {
    setFormSku(sku);
    setFormOpen(true);
    setResultsOpen(false);
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
      <IonContent>
        <PageHeader
          title="POS"
          actions={
            <>
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
            </>
          }
        />

        <ConnectionBanner />

        <div className="screen">
          <div className="search-wrap" ref={searchWrapRef}>
            <div className="search">
              <IonIcon className="search__icon" icon={searchOutline} aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setResultsOpen(e.target.value.trim() !== '');
                }}
                onFocus={() => setResultsOpen(search.trim() !== '')}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setResultsOpen(false);
                }}
                placeholder="Cari produk atau SKU"
                aria-label="Cari produk untuk keranjang"
              />
              {search !== '' && (
                <button
                  type="button"
                  className="search__clear"
                  aria-label="Hapus pencarian"
                  onClick={() => {
                    setSearch('');
                    setResultsOpen(false);
                  }}
                >
                  <IonIcon icon={closeCircle} />
                </button>
              )}
            </div>

            {resultsOpen && (
              <>
                <div
                  className="search-pop__backdrop"
                  aria-hidden="true"
                  onClick={() => setResultsOpen(false)}
                />

                <div className="search-pop" role="region" aria-label="Hasil pencarian">
                  <div className="search-pop__head">
                    <span className="search-pop__title">Hasil pencarian</span>
                    <button
                      type="button"
                      className="search-pop__close"
                      aria-label="Tutup hasil pencarian"
                      onClick={() => setResultsOpen(false)}
                    >
                      <IonIcon icon={closeCircle} />
                    </button>
                  </div>

                  <div className="search-pop__body">
                    {resultsQuery.isLoading && (
                      <div className="spinner-center">
                        <IonSpinner name="crescent" />
                      </div>
                    )}

                    {!resultsQuery.isLoading && results.length === 0 && (
                      <div className="empty-state">
                        <p className="empty-state__title">Produk tidak ditemukan</p>
                        <p className="empty-state__text">
                          Periksa ejaan, atau tambahkan produk baru.
                        </p>
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

                    {results.map((product) => (
                      <ProductRow
                        key={product.id}
                        product={product}
                        onClick={() => selectResult(product)}
                        aside={
                          <span className="product-row__aside">
                            <span className="product-row__price">
                              {formatRupiah(product.selling_price)}
                            </span>
                            <IonIcon
                              icon={addCircleOutline}
                              style={{ color: 'var(--app-blue)', fontSize: 19.8 }}
                            />
                          </span>
                        }
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="section-head">
            <h2 className="section-head__title">Keranjang</h2>
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
                <div key={line.product.id} className="cart-card">
                  <span className="thumb" aria-hidden="true">
                    {line.product.name.trim().charAt(0).toUpperCase() || '?'}
                  </span>

                  <div className="cart-card__body">
                    <p className="cart-card__name">{line.product.name}</p>
                    <p className="cart-card__unit">
                      {formatRupiah(line.product.selling_price)}
                    </p>
                    <p className="cart-card__total">
                      {formatRupiah(line.product.selling_price * line.quantity)}
                    </p>
                  </div>

                  <div className="cart-card__controls">
                    <span className="stepper">
                      <button
                        type="button"
                        className="stepper__btn"
                        aria-label={`Kurangi ${line.product.name}`}
                        onClick={() => cart.changeQuantity(line.product.id, -1)}
                      >
                        <IonIcon icon={removeOutline} aria-hidden="true" />
                      </button>
                      <span className="stepper__value">{line.quantity}</span>
                      <button
                        type="button"
                        className="stepper__btn"
                        aria-label={`Tambah ${line.product.name}`}
                        onClick={() => cart.changeQuantity(line.product.id, 1)}
                      >
                        <IonIcon icon={addOutline} aria-hidden="true" />
                      </button>
                    </span>

                    <button
                      type="button"
                      className="cart-card__remove"
                      aria-label={`Hapus ${line.product.name}`}
                      onClick={() => cart.remove(line.product.id)}
                    >
                      <IonIcon icon={trashOutline} />
                    </button>
                  </div>
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
