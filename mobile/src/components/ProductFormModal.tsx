import { useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonNote,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { barcodeOutline, sparklesOutline } from 'ionicons/icons';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { productsApi, type ProductInput } from '../api/products';
import { ApiError, describeDetails } from '../lib/http';
import { saveProduct } from '../lib/offline/products';
import { productKeys } from '../lib/queryKeys';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ScannerError, scannerService } from '../services/scanner';
import type { Category, Product } from '../types';

const schema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(255, 'Maksimal 255 karakter'),
  /** Empty means "generate on create / keep as-is on edit". */
  sku: z.string().trim().max(255, 'Maksimal 255 karakter'),
  unit: z.string().trim().min(1, 'Satuan wajib diisi').max(50, 'Maksimal 50 karakter'),
  selling_price: z
    .string()
    .trim()
    .min(1, 'Harga wajib diisi')
    .regex(/^\d+$/, 'Hanya boleh angka'),
  category_id: z.number().int().nullable(),
  notes: z.string().trim(),
});

type FormValues = z.infer<typeof schema>;

interface ProductFormModalProps {
  isOpen: boolean;
  /** The product being edited, or null to create a new one. */
  product: Product | null;
  /** Pre-fills the SKU when creating (e.g. from a scan that found nothing). */
  initialSku?: string;
  categories: Category[];
  onDismiss: () => void;
  onSaved: (message: string, color?: 'success' | 'warning' | 'danger') => void;
}

const emptyValues: FormValues = {
  name: '',
  sku: '',
  unit: 'pcs',
  selling_price: '',
  category_id: null,
  notes: '',
};

function toFormValues(product: Product | null, initialSku?: string): FormValues {
  if (!product) return { ...emptyValues, sku: initialSku ?? '' };
  return {
    name: product.name,
    sku: product.sku,
    unit: product.unit,
    selling_price: String(product.selling_price),
    category_id: product.category_id,
    notes: product.notes ?? '',
  };
}

/**
 * Add/Edit Produk. SKU is the product's only code: it can be generated, typed,
 * or filled from a barcode scan.
 */
const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  product,
  initialSku,
  categories,
  onDismiss,
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const [fieldNotice, setFieldNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { control, handleSubmit, reset, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  const skuValue = watch('sku');

  // Reload the form whenever it opens for a different product.
  useEffect(() => {
    if (isOpen) {
      reset(toFormValues(product, initialSku));
      setFieldNotice(null);
      setSubmitError(null);
    }
  }, [isOpen, product, initialSku, reset]);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const input: ProductInput = {
      name: values.name,
      unit: values.unit,
      selling_price: Number(values.selling_price),
      category_id: values.category_id,
      notes: values.notes || null,
    };
    // On edit an empty SKU means "keep the existing one"; on create the
    // backend generates one.
    if (values.sku) input.sku = values.sku;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await saveProduct(product, input);
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      onSaved(
        result === 'conflict'
          ? 'Produk diubah di perangkat lain. Buka ikon sinkronisasi untuk memilih versi.'
          : result === 'queued'
            ? 'Tanpa koneksi: perubahan disimpan dan akan disinkron otomatis.'
            : product
              ? 'Produk diperbarui.'
              : 'Produk ditambahkan.',
        result === 'conflict' ? 'warning' : 'success',
      );
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? (describeDetails(error.details) ?? error.message)
          : 'Gagal menyimpan produk.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleScan = async () => {
    setFieldNotice(null);
    setBusy(true);
    try {
      const result = await scannerService.scan();
      if (result?.value) setValue('sku', result.value, { shouldValidate: true });
    } catch (error) {
      setFieldNotice(error instanceof ScannerError ? error.message : 'Pemindaian gagal.');
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    setFieldNotice(null);
    setBusy(true);
    try {
      const { data } = await productsApi.nextSku();
      setValue('sku', data.sku, { shouldValidate: true });
    } catch (error) {
      setFieldNotice(
        error instanceof ApiError ? error.message : 'Gagal membuat SKU otomatis. Isi manual saja.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader className="app-header">
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>Batal</IonButton>
          </IonButtons>
          <IonTitle className="app-title-bar">
            {product ? 'Edit Produk' : 'Tambah Produk'}
          </IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={handleSubmit(onSubmit)} disabled={submitting || busy}>
              {submitting ? <IonSpinner name="dots" /> : 'Simpan'}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="screen">
          <form onSubmit={handleSubmit(onSubmit)}>
            <label className="field">
              <span className="field__label">Nama produk *</span>
              <Controller
                control={control}
                name="name"
                render={({ field, fieldState }) => (
                  <>
                    <input
                      className="input"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      onBlur={field.onBlur}
                      placeholder="Misal: Air Mineral 600ml"
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.error && (
                      <span className="field__error">{fieldState.error.message}</span>
                    )}
                  </>
                )}
              />
            </label>

            <div className="field">
              <span className="field__label">SKU / Barcode *</span>
              <div className="field__row">
                <Controller
                  control={control}
                  name="sku"
                  render={({ field, fieldState }) => (
                    <>
                      <input
                        className="input"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        placeholder="Kosongkan untuk otomatis"
                        aria-label="SKU"
                        aria-invalid={fieldState.invalid}
                      />
                      <button
                        type="button"
                        className="btn btn--icon"
                        aria-label="Buat SKU otomatis"
                        disabled={busy}
                        onClick={handleGenerate}
                      >
                        <IonIcon icon={sparklesOutline} />
                      </button>
                      <button
                        type="button"
                        className="btn btn--icon"
                        aria-label="Pindai barcode"
                        disabled={busy}
                        onClick={handleScan}
                      >
                        <IonIcon icon={barcodeOutline} />
                      </button>
                      {fieldState.error && (
                        <span className="field__error">{fieldState.error.message}</span>
                      )}
                    </>
                  )}
                />
              </div>
              <span className="field__hint">
                SKU sama dengan barcode. Kosongkan untuk dibuat otomatis (PRD-xxxxxx).
              </span>
              {skuValue === '' && product && (
                <span className="field__hint">Dibiarkan kosong: SKU lama tetap dipakai.</span>
              )}
            </div>

            <div className="field__row" style={{ gap: 12 }}>
              <label className="field" style={{ flex: 1 }}>
                <span className="field__label">Satuan *</span>
                <Controller
                  control={control}
                  name="unit"
                  render={({ field, fieldState }) => (
                    <>
                      <input
                        className="input"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        placeholder="pcs"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.error && (
                        <span className="field__error">{fieldState.error.message}</span>
                      )}
                    </>
                  )}
                />
              </label>

              <label className="field" style={{ flex: 1.4 }}>
                <span className="field__label">Harga jual (Rp) *</span>
                <Controller
                  control={control}
                  name="selling_price"
                  render={({ field, fieldState }) => (
                    <>
                      <input
                        className="input"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                        onBlur={field.onBlur}
                        placeholder="0"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.error && (
                        <span className="field__error">{fieldState.error.message}</span>
                      )}
                    </>
                  )}
                />
              </label>
            </div>

            <label className="field">
              <span className="field__label">Kategori</span>
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <select
                    className="input"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                  >
                    <option value="">Tanpa kategori</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                )}
              />
            </label>

            <label className="field">
              <span className="field__label">Catatan</span>
              <Controller
                control={control}
                name="notes"
                render={({ field }) => (
                  <textarea
                    className="input"
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder="Opsional"
                  />
                )}
              />
            </label>

            {submitError && <p className="note note--error">{submitError}</p>}
            {fieldNotice && <p className="note note--warn">{fieldNotice}</p>}
            {!online && (
              <p className="note note--warn">
                Tanpa koneksi. Perubahan disimpan di perangkat dan disinkron otomatis saat online
                kembali.
              </p>
            )}

            <button type="submit" className="btn btn--primary" disabled={submitting || busy}>
              {submitting ? <IonSpinner name="dots" /> : product ? 'Simpan Perubahan' : 'Simpan Produk'}
            </button>
            <IonNote
              style={{
                display: 'block',
                textAlign: 'center',
                marginTop: 10,
                fontSize: 12,
                color: 'var(--app-faint)',
              }}
            >
              Foto produk tidak diperlukan di versi ini.
            </IonNote>
          </form>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default ProductFormModal;
