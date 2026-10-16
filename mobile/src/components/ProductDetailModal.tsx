import { useState } from 'react';
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonAlert,
} from '@ionic/react';
import { useQueryClient } from '@tanstack/react-query';
import { formatRupiah } from '../lib/format';
import { archiveProduct } from '../lib/offline/products';
import { productKeys } from '../lib/queryKeys';
import type { Category, Product } from '../types';

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

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>Tutup</IonButton>
          </IonButtons>
          <IonTitle>Detail Produk</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <h1 style={{ marginTop: 0 }}>{product.name}</h1>
        <h2 style={{ color: 'var(--ion-color-primary)', marginTop: 0 }}>
          {formatRupiah(product.selling_price)}
        </h2>
        {!product.is_active && <IonBadge color="medium">Diarsipkan</IonBadge>}

        <IonList>
          <IonItem>
            <IonLabel>
              <h3>SKU</h3>
              <p>{product.sku}</p>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>
              <h3>Barcode</h3>
              <p>{product.barcode ?? '—'}</p>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>
              <h3>Satuan</h3>
              <p>{product.unit}</p>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>
              <h3>Kategori</h3>
              <p>{categoryName}</p>
            </IonLabel>
          </IonItem>
          {product.notes && (
            <IonItem>
              <IonLabel>
                <h3>Catatan</h3>
                <p>{product.notes}</p>
              </IonLabel>
            </IonItem>
          )}
        </IonList>

        {archiveError && (
          <IonNote color="danger" className="ion-display-block ion-padding-vertical">
            Gagal mengarsipkan produk.
          </IonNote>
        )}

        <IonButton expand="block" className="ion-margin-top" onClick={() => onEdit(product)}>
          Edit
        </IonButton>
        <IonButton
          expand="block"
          color="danger"
          fill="outline"
          disabled={archiving}
          onClick={confirmArchive}
        >
          {archiving ? <IonSpinner name="dots" /> : isPendingCreate ? 'Batalkan draf' : 'Arsipkan'}
        </IonButton>
      </IonContent>
    </IonModal>
  );
};

export default ProductDetailModal;
