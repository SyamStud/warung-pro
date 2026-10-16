import { useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonModal,
  IonSpinner,
  useIonAlert,
} from '@ionic/react';
import { createOutline, trashOutline } from 'ionicons/icons';
import { useQueryClient } from '@tanstack/react-query';
import { formatRupiah } from '../lib/format';
import { archiveProduct } from '../lib/offline/products';
import { productKeys } from '../lib/queryKeys';
import type { Category, Product } from '../types';
import PageHeader from './PageHeader';

interface ProductDetailModalProps {
  isOpen: boolean;
  product: Product | null;
  categories: Category[];
  onDismiss: () => void;
  onEdit: (product: Product) => void;
  onArchived: (message: string) => void;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  product,
  categories,
  onDismiss,
  onEdit,
  onArchived,
}) => {
  const queryClient = useQueryClient();
  const [presentAlert] = useIonAlert();
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState(false);

  if (!product) return null;

  const isPendingCreate = product.id < 0;

  const runArchive = async () => {
    setArchiving(true);
    setArchiveError(false);
    try {
      const result = await archiveProduct(product);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      onArchived(
        result === 'queued'
          ? isPendingCreate
            ? 'Draf produk dibatalkan.'
            : 'Tanpa koneksi: arsip akan disinkron otomatis.'
          : 'Produk diarsipkan.',
      );
    } catch {
      setArchiveError(true);
    } finally {
      setArchiving(false);
    }
  };

  const categoryName =
    categories.find((category) => category.id === product.category_id)?.name ?? 'Tanpa kategori';

  const confirmArchive = () => {
    presentAlert({
      header: isPendingCreate ? 'Batalkan draf?' : 'Arsipkan produk?',
      message: isPendingCreate
        ? `"${product.name}" belum tersinkron dan akan dihapus dari antrean.`
        : `"${product.name}" akan disembunyikan dari katalog. Riwayat transaksi tetap tersimpan.`,
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: isPendingCreate ? 'Batalkan draf' : 'Arsipkan',
          role: 'destructive',
          handler: () => {
            void runArchive();
          },
        },
      ],
    });
  };

  const details: { label: string; value: string }[] = [
    { label: 'SKU / Barcode', value: product.sku },
    { label: 'Satuan', value: product.unit },
    { label: 'Kategori', value: categoryName },
    { label: 'Status', value: product.is_active ? 'Aktif' : 'Diarsipkan' },
  ];

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonContent>
        <PageHeader title="Detail Produk" onBack={onDismiss} />

        <div className="screen">
          <div className="card" style={{ textAlign: 'center' }}>
            <span
              className="thumb"
              style={{ width: 72, height: 72, fontSize: 25.2, margin: '0 auto 12px' }}
              aria-hidden="true"
            >
              {product.name.trim().charAt(0).toUpperCase() || '?'}
            </span>
            <h2 style={{ margin: '0 0 6px', fontSize: 16.2, fontWeight: 700 }}>{product.name}</h2>
            <p
              style={{
                margin: 0,
                fontSize: 21.6,
                fontWeight: 800,
                color: 'var(--app-blue)',
              }}
            >
              {formatRupiah(product.selling_price)}
            </p>
            <p style={{ margin: '6px 0 0', color: 'var(--app-muted)', fontSize: 11.7 }}>
              per {product.unit}
            </p>

            {product.id < 0 && (
              <p className="badge badge--amber" style={{ marginTop: 10 }}>
                Menunggu sinkron
              </p>
            )}
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            {details.map((row) => (
              <div key={row.label} className="totals__row" style={{ marginBottom: 10 }}>
                <span>{row.label}</span>
                <span style={{ color: 'var(--app-ink)', fontWeight: 600 }}>{row.value}</span>
              </div>
            ))}

            {product.notes && (
              <>
                <hr className="totals__divider" />
                <p style={{ margin: '10px 0 0', fontSize: 11.7, color: 'var(--app-muted)' }}>
                  {product.notes}
                </p>
              </>
            )}
          </div>

          {archiveError && <p className="note note--error">Gagal mengarsipkan produk.</p>}

          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 16 }}
            onClick={() => onEdit(product)}
          >
            <IonIcon icon={createOutline} /> Edit Produk
          </button>

          <button
            type="button"
            className="btn btn--danger"
            style={{ marginTop: 10 }}
            disabled={archiving}
            onClick={confirmArchive}
          >
            {archiving ? <IonSpinner name="dots" /> : <IonIcon icon={trashOutline} />}
            {archiving ? 'Memproses...' : isPendingCreate ? 'Batalkan draf' : 'Arsipkan Produk'}
          </button>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default ProductDetailModal;
