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
import { pencilOutline, pricetagsOutline, trashOutline } from 'ionicons/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '../api/categories';
import ConnectionBanner from '../components/ConnectionBanner';
import PageHeader from '../components/PageHeader';
import { ApiError, describeDetails } from '../lib/http';
import { categoryKeys, productKeys } from '../lib/queryKeys';
import type { Category } from '../types';

/** Turn an API failure into something worth showing in a toast. */
function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? (describeDetails(error.details) ?? error.message) : fallback;
}

/**
 * Kelola Kategori — reached from the button next to the Katalog Produk title.
 * Add, rename and delete; deleting a category leaves its products in place
 * (they simply become uncategorised).
 */
const Categories: React.FC = () => {
  const queryClient = useQueryClient();
  const [presentToast] = useIonToast();
  const [presentAlert] = useIonAlert();

  const [name, setName] = useState('');

  const query = useQuery({
    queryKey: categoryKeys.all,
    queryFn: ({ signal }) => categoriesApi.list(signal),
  });
  const categories = query.data?.data ?? [];

  const toast = (message: string, color: 'success' | 'danger' = 'success') =>
    presentToast({ message, duration: 2000, color, position: 'top' });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: categoryKeys.all });
    // Products carry their category name in list responses.
    void queryClient.invalidateQueries({ queryKey: productKeys.all });
  };

  const create = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: (result) => {
      setName('');
      invalidate();
      toast(`Kategori "${result.data.name}" ditambahkan.`);
    },
    onError: (error) => toast(errorMessage(error, 'Gagal menambah kategori.'), 'danger'),
  });

  const rename = useMutation({
    mutationFn: ({ id, nextName }: { id: number; nextName: string }) =>
      categoriesApi.rename(id, nextName),
    onSuccess: () => {
      invalidate();
      toast('Kategori diperbarui.');
    },
    onError: (error) => toast(errorMessage(error, 'Gagal mengubah kategori.'), 'danger'),
  });

  const remove = useMutation({
    mutationFn: categoriesApi.remove,
    onSuccess: () => {
      invalidate();
      toast('Kategori dihapus.');
    },
    onError: (error) => toast(errorMessage(error, 'Gagal menghapus kategori.'), 'danger'),
  });

  const busy = create.isPending || rename.isPending || remove.isPending;
  const trimmed = name.trim();

  const submit = () => {
    if (trimmed === '' || busy) return;
    create.mutate(trimmed);
  };

  const promptRename = (category: Category) => {
    presentAlert({
      header: 'Ubah nama kategori',
      inputs: [{ name: 'name', type: 'text', value: category.name }],
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Simpan',
          handler: (data: { name?: string }) => {
            const nextName = data.name?.trim();
            if (nextName && nextName !== category.name) {
              rename.mutate({ id: category.id, nextName });
            }
          },
        },
      ],
    });
  };

  const promptDelete = (category: Category) => {
    presentAlert({
      header: 'Hapus kategori?',
      message: `"${category.name}" akan dihapus. Produknya tetap ada, hanya jadi tanpa kategori.`,
      buttons: [
        { text: 'Batal', role: 'cancel' },
        {
          text: 'Hapus',
          role: 'destructive',
          handler: () => remove.mutate(category.id),
        },
      ],
    });
  };

  const listError =
    query.isError &&
    errorMessage(query.error, 'Gagal memuat kategori.');

  return (
    <IonPage>
      <IonContent>
        <PageHeader title="Kelola Kategori" backHref="/tabs/products" />

        <ConnectionBanner />

        <div className="screen">
          <div className="card">
            <h2 className="card__title" style={{ marginBottom: 10 }}>
              Kategori baru
            </h2>
            <div className="field__row">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit();
                }}
                placeholder="Nama kategori"
                aria-label="Nama kategori baru"
              />
              <button
                type="button"
                className="btn btn--sm btn--primary"
                disabled={trimmed === '' || busy}
                onClick={submit}
              >
                {create.isPending ? <IonSpinner name="dots" /> : 'Tambah'}
              </button>
            </div>
          </div>

          <div className="section-head">
            <h2 className="section-head__title">
              {categories.length > 0 ? `${categories.length} kategori` : 'Kategori'}
            </h2>
          </div>

          {query.isLoading && (
            <div className="spinner-center">
              <IonSpinner name="crescent" />
            </div>
          )}

          {listError && <IonNote className="note note--error">{listError}</IonNote>}

          {!query.isLoading && !listError && categories.length === 0 && (
            <div className="card empty-state">
              <IonIcon className="empty-state__icon" icon={pricetagsOutline} />
              <p className="empty-state__title">Belum ada kategori</p>
              <p className="empty-state__text">
                Tambahkan kategori supaya produk lebih mudah dicari di katalog.
              </p>
            </div>
          )}

          <div className="list-stack">
            {categories.map((category) => (
              <div key={category.id} className="product-row category-row">
                <span className="thumb" aria-hidden="true">
                  <IonIcon icon={pricetagsOutline} />
                </span>

                <span className="product-row__main">
                  <span className="product-row__name">{category.name}</span>
                </span>

                <span className="row-actions">
                  <button
                    type="button"
                    className="btn btn--icon"
                    aria-label={`Ubah nama ${category.name}`}
                    disabled={busy}
                    onClick={() => promptRename(category)}
                  >
                    <IonIcon icon={pencilOutline} />
                  </button>
                  <button
                    type="button"
                    className="btn btn--icon btn--danger"
                    aria-label={`Hapus ${category.name}`}
                    disabled={busy}
                    onClick={() => promptDelete(category)}
                  >
                    <IonIcon icon={trashOutline} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Categories;
