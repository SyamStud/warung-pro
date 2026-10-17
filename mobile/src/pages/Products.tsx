import { useState } from 'react';
import {
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  useIonToast,
} from '@ionic/react';
import { addOutline, closeCircle, cloudUploadOutline, pricetagsOutline, searchOutline } from 'ionicons/icons';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { categoriesApi } from '../api/categories';
import { productsApi, type ProductSort } from '../api/products';
import ProductDetailModal from '../components/ProductDetailModal';
import ProductFormModal from '../components/ProductFormModal';
import ProductRow from '../components/ProductRow';
import ImportProductsModal from '../components/ImportProductsModal';
import ConnectionBanner from '../components/ConnectionBanner';
import PageHeader from '../components/PageHeader';
import SyncStatus from '../components/SyncStatus';
import { categoryKeys, productKeys } from '../lib/queryKeys';
import { ApiError } from '../lib/http';
import { applyOverlay } from '../lib/offline/products';
import { useOutbox } from '../hooks/useOutbox';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { Product } from '../types';

const PAGE_SIZE = 20;

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'newest', label: 'Terbaru' },
  { value: 'name', label: 'Nama A-Z' },
  { value: 'price_asc', label: 'Harga terendah' },
  { value: 'price_desc', label: 'Harga tertinggi' },
];

/** 5 · Katalog Produk — search, category chips, sort, and the product list. */
const Products: React.FC = () => {
  const navigate = useNavigate();
  const [presentToast] = useIonToast();
  const { overlay } = useOutbox();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [sort, setSort] = useState<ProductSort>('newest');
  const debouncedSearch = useDebouncedValue(search, 300);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const filters = {
    search: debouncedSearch.trim() || undefined,
    category_id: categoryId,
    sort,
  };

  const categoriesQuery = useQuery({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => categoriesApi.list(signal),
  });
  const categories = categoriesQuery.data?.data ?? [];

  const productsQuery = useInfiniteQuery({
    queryKey: productKeys.list(filters),
    queryFn: ({ pageParam, signal }) =>
      productsApi.list({ ...filters, page: pageParam, per_page: PAGE_SIZE }, signal),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.meta.current_page < lastPage.meta.last_page
        ? lastPage.meta.current_page + 1
        : undefined,
  });

  const products = productsQuery.data?.pages.flatMap((page) => page.data) ?? [];
  // Reflect queued (offline) changes on top of server data.
  const visibleProducts = applyOverlay(products, overlay);

  const showToast = (message: string, color: string = 'success') =>
    presentToast({ message, duration: 2000, color, position: 'top' });

  const listError =
    productsQuery.isError &&
    (productsQuery.error instanceof ApiError
      ? productsQuery.error.message
      : 'Gagal memuat produk.');

  return (
    <IonPage>
      <IonContent>
        <IonRefresher
          slot="fixed"
          onIonRefresh={async (event) => {
            await Promise.all([productsQuery.refetch(), categoriesQuery.refetch()]);
            await event.detail.complete();
          }}
        >
          <IonRefresherContent />
        </IonRefresher>

        <div className="sticky-top">
          <PageHeader
            title="Katalog Produk"
            actions={
              <>
                <button
                  type="button"
                  className="btn btn--icon"
                  aria-label="Impor dari Excel"
                  onClick={() => setImportOpen(true)}
                >
                  <IonIcon icon={cloudUploadOutline} />
                </button>
                <button
                  type="button"
                  className="btn btn--icon"
                  aria-label="Kelola kategori"
                  onClick={() => navigate('/tabs/categories')}
                >
                  <IonIcon icon={pricetagsOutline} />
                </button>
                <SyncStatus />
              </>
            }
          />

          <ConnectionBanner />

          <div className="sticky-top__body">
            <div className="search">
              <IonIcon className="search__icon" icon={searchOutline} aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau SKU"
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

            <div className="chip-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className={`chip${categoryId === null ? ' chip--active' : ''}`}
                onClick={() => setCategoryId(null)}
              >
                Semua
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  className={`chip${categoryId === category.id ? ' chip--active' : ''}`}
                  onClick={() => setCategoryId(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="section-head" style={{ marginBottom: 0 }}>
              <h2 className="section-head__title">
                {visibleProducts.length > 0 ? `${visibleProducts.length} produk` : 'Produk'}
              </h2>
              <select
                className="input"
                style={{ minHeight: 42, width: 'auto', fontSize: 11.7, paddingRight: 34 }}
                value={sort}
                aria-label="Urutkan produk"
                onChange={(e) => setSort(e.target.value as ProductSort)}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="screen screen--flush">
          {productsQuery.isLoading && (
            <div className="spinner-center">
              <IonSpinner name="crescent" />
            </div>
          )}

          {listError && <IonNote className="note note--error">{listError}</IonNote>}

          {!productsQuery.isLoading && !listError && visibleProducts.length === 0 && (
            <div className="card empty-state">
              <p className="empty-state__title">Produk tidak ditemukan</p>
              <p className="empty-state__text">
                Coba kata kunci lain, atau tambahkan produk baru lewat tombol +.
              </p>
            </div>
          )}

          <div className="list-stack">
            {visibleProducts.map((product) => (
              <ProductRow key={product.id} product={product} onClick={() => setDetail(product)} />
            ))}
          </div>

          <IonInfiniteScroll
            disabled={!productsQuery.hasNextPage}
            onIonInfinite={async (event) => {
              await productsQuery.fetchNextPage();
              await event.target.complete();
            }}
          >
            <IonInfiniteScrollContent loadingText="Memuat lagi..." />
          </IonInfiniteScroll>
        </div>
      </IonContent>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <IonIcon icon={addOutline} />
        </IonFabButton>
      </IonFab>

      <ProductFormModal
        isOpen={formOpen}
        product={editing}
        categories={categories}
        onDismiss={() => setFormOpen(false)}
        onSaved={(message, color) => {
          setFormOpen(false);
          showToast(message, color);
        }}
      />

      <ProductDetailModal
        isOpen={detail !== null}
        product={detail}
        categories={categories}
        onDismiss={() => setDetail(null)}
        onEdit={(product) => {
          setDetail(null);
          setEditing(product);
          setFormOpen(true);
        }}
        onArchived={(message) => {
          setDetail(null);
          showToast(message);
        }}
      />

      <ImportProductsModal
        isOpen={importOpen}
        onDismiss={() => setImportOpen(false)}
        onImported={(message) => showToast(message)}
      />
    </IonPage>
  );
};

export default Products;
