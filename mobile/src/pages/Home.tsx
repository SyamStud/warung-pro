import { useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonNote,
  IonPage,
  IonSpinner,
  useIonToast,
} from '@ionic/react';
import {
  addCircleOutline,
  cartOutline,
  chevronForwardOutline,
  pricetagOutline,
  receiptOutline,
} from 'ionicons/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { categoriesApi } from '../api/categories';
import { productsApi } from '../api/products';
import ConnectionBanner from '../components/ConnectionBanner';
import PageHeader from '../components/PageHeader';
import ProductFormModal from '../components/ProductFormModal';
import ProductRow from '../components/ProductRow';
import SyncStatus from '../components/SyncStatus';
import { useAuth } from '../auth/useAuth';
import { useOutbox } from '../hooks/useOutbox';
import { categoryKeys, productKeys } from '../lib/queryKeys';
import { ApiError } from '../lib/http';
import { applyOverlay } from '../lib/offline/products';

/** 3 · Beranda — greeting, quick actions, and the newest products. */
const Home: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { overlay } = useOutbox();
  const [presentToast] = useIonToast();
  const [formOpen, setFormOpen] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => categoriesApi.list(signal),
  });
  const categories = categoriesQuery.data?.data ?? [];

  const productsQuery = useQuery({
    queryKey: productKeys.list({ sort: 'newest' }),
    queryFn: ({ signal }) => productsApi.list({ sort: 'newest', per_page: 3 }, signal),
  });
  const products = applyOverlay(productsQuery.data?.data ?? [], overlay);

  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || 'Kak';
  const error =
    productsQuery.isError &&
    (productsQuery.error instanceof ApiError ? productsQuery.error.message : 'Gagal memuat produk.');

  const actions = [
    {
      title: 'Cek Harga',
      hint: 'Pindai barcode',
      icon: pricetagOutline,
      onClick: () => navigate('/tabs/check'),
    },
    {
      title: 'Tambah Produk',
      hint: 'Barang baru',
      icon: addCircleOutline,
      onClick: () => setFormOpen(true),
    },
    {
      title: 'Kasir',
      hint: 'Mulai transaksi',
      icon: cartOutline,
      onClick: () => navigate('/tabs/pos'),
    },
    {
      title: 'Riwayat',
      hint: 'Struk & penjualan',
      icon: receiptOutline,
      onClick: () => navigate('/tabs/history'),
    },
  ];

  return (
    <IonPage>
      <IonContent>
        <PageHeader title="Beranda" hideBack actions={<SyncStatus />} />

        <ConnectionBanner />

        <div className="screen">
          <div className="greeting">
            <span className="greeting__avatar" aria-hidden="true">
              {firstName.charAt(0).toUpperCase()}
            </span>
            <div>
              <h1 className="greeting__name">Halo, {firstName} 👋</h1>
              <p className="greeting__hint">Semangat jualan hari ini!</p>
            </div>
          </div>

          <div className="section-head">
            <h2 className="section-head__title">Aksi cepat</h2>
          </div>

          <div className="action-grid">
            {actions.map((action) => (
              <button key={action.title} type="button" className="action-card" onClick={action.onClick}>
                <span className="action-card__icon">
                  <IonIcon icon={action.icon} />
                </span>
                <span className="action-card__title">{action.title}</span>
                <span className="action-card__hint">{action.hint}</span>
              </button>
            ))}
          </div>

          <div className="section-head">
            <h2 className="section-head__title">Produk terbaru</h2>
            <button type="button" className="link" onClick={() => navigate('/tabs/products')}>
              Lihat semua <IonIcon icon={chevronForwardOutline} />
            </button>
          </div>

          {productsQuery.isLoading && (
            <div className="spinner-center">
              <IonSpinner name="crescent" />
            </div>
          )}

          {error && <IonNote className="note note--error">{error}</IonNote>}

          {!productsQuery.isLoading && !error && products.length === 0 && (
            <div className="card empty-state">
              <p className="empty-state__title">Belum ada produk</p>
              <p className="empty-state__text">
                Tambahkan produk pertama supaya bisa dijual di POS.
              </p>
            </div>
          )}

          <div className="list-stack">
            {products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onClick={() => navigate('/tabs/products')}
              />
            ))}
          </div>
        </div>
      </IonContent>

      <ProductFormModal
        isOpen={formOpen}
        product={null}
        categories={categories}
        onDismiss={() => setFormOpen(false)}
        onSaved={(message, color) => {
          setFormOpen(false);
          presentToast({ message, duration: 2000, color, position: 'top' });
          void queryClient.invalidateQueries({ queryKey: productKeys.all });
        }}
      />
    </IonPage>
  );
};

export default Home;
