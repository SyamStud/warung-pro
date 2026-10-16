import { useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
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
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonAlert,
  useIonToast,
} from '@ionic/react';
import { addOutline, pricetagsOutline } from 'ionicons/icons';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../api/categories';
import { productsApi } from '../api/products';
import ProductDetailModal from '../components/ProductDetailModal';
import ProductFormModal from '../components/ProductFormModal';
import ConnectionBanner from '../components/ConnectionBanner';
import SyncStatus from '../components/SyncStatus';
import { formatRupiah } from '../lib/format';
import { categoryKeys, productKeys } from '../lib/queryKeys';
import { ApiError } from '../lib/http';
import { applyOverlay } from '../lib/offline/products';
import { useOutbox } from '../hooks/useOutbox';
import { useDebouncedValue } from '../lib/useDebouncedValue';
import type { Product } from '../types';

const PAGE_SIZE = 20;

const Products: React.FC = () => {
  const queryClient = useQueryClient();
  const [presentToast] = useIonToast();
  const [presentAlert] = useIonAlert();
  const { overlay } = useOutbox();

  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const debouncedSearch = useDebouncedValue(search, 300);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);

  const filters = { search: debouncedSearch || undefined, category_id: categoryId };

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

  const createCategory = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: categoryKeys.all }),
  });

  const showToast = (message: string, color: string = 'success') =>
    presentToast({ message, duration: 2000, color, position: 'top' });

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const promptAddCategory = () => {
    presentAlert({
      header: 'Kategori baru',
      inputs: [{ name: 'name', type: 'text', placeholder: 'Nama kategori' }],
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Simpan',
          handler: (data: { name?: string }) => {
            const name = data.name?.trim();
            if (name) createCategory.mutate(name);
          },
        },
      ],
    });
  };

  const listError =
    productsQuery.isError &&
    (productsQuery.error instanceof ApiError
      ? productsQuery.error.message
      : 'Gagal memuat produk.');

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Produk</IonTitle>
          <IonButtons slot="end">
            <SyncStatus />
            <IonButton onClick={promptAddCategory}>
              <IonIcon slot="icon-only" icon={pricetagsOutline} />
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
        <IonToolbar>
          <IonSelect
            value={categoryId}
            placeholder="Semua kategori"
            onIonChange={(e) => setCategoryId(e.detail.value ?? null)}
          >
            <IonSelectOption value={null}>Semua kategori</IonSelectOption>
            {categories.map((category) => (
              <IonSelectOption key={category.id} value={category.id}>
                {category.name}
              </IonSelectOption>
            ))}
          </IonSelect>
        </IonToolbar>
      </IonHeader>

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

        <ConnectionBanner />

        {productsQuery.isLoading && (
          <div className="ion-padding ion-text-center">
            <IonSpinner name="crescent" />
          </div>
        )}

        {listError && (
          <IonNote color="danger" className="ion-display-block ion-padding">
            {listError}
          </IonNote>
        )}

        {!productsQuery.isLoading && !listError && visibleProducts.length === 0 && (
          <IonNote color="medium" className="ion-display-block ion-padding">
            Belum ada produk. Tekan tombol + untuk menambahkan.
          </IonNote>
        )}

        <IonList>
          {visibleProducts.map((product) => (
            <IonItem key={product.id} button onClick={() => setDetail(product)}>
              <IonLabel>
                <h2>{product.name}</h2>
                <p>
                  {product.sku}
                  {product.barcode ? ` · ${product.barcode}` : ''}
                </p>
              </IonLabel>
              <div slot="end" style={{ textAlign: 'right' }}>
                <div>{formatRupiah(product.selling_price)}</div>
                {product.id < 0 && <IonBadge color="warning">Menunggu</IonBadge>}
                {!product.is_active && <IonBadge color="medium">Arsip</IonBadge>}
              </div>
            </IonItem>
          ))}
        </IonList>

        <IonInfiniteScroll
          disabled={!productsQuery.hasNextPage}
          onIonInfinite={async (event) => {
            await productsQuery.fetchNextPage();
            await event.target.complete();
          }}
        >
          <IonInfiniteScrollContent loadingText="Memuat lagi..." />
        </IonInfiniteScroll>
      </IonContent>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton onClick={openCreate}>
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
    </IonPage>
  );
};

export default Products;
