import { useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { barcodeOutline } from 'ionicons/icons';
import { Controller, useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { type ProductInput } from '../api/products';
import { ApiError } from '../lib/http';
import { saveProduct } from '../lib/offline/products';
import { productKeys } from '../lib/queryKeys';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ScannerError, scannerService } from '../services/scanner';
import type { Category, Product } from '../types';

const schema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(255, 'Maksimal 255 karakter'),
  sku: z.string().trim().max(255, 'Maksimal 255 karakter'),
  barcode: z.string().trim().max(255, 'Maksimal 255 karakter'),
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
  /** Pre-fills the barcode field when creating (e.g. from a failed scan). */
  initialBarcode?: string;
  categories: Category[];
  onDismiss: () => void;
  onSaved: (message: string) => void;
}

const emptyValues: FormValues = {
  name: '',
  sku: '',
  barcode: '',
  unit: 'pcs',
  selling_price: '',
  category_id: null,
  notes: '',
};

function toFormValues(product: Product | null, initialBarcode?: string): FormValues {
  if (!product) return { ...emptyValues, barcode: initialBarcode ?? '' };
  return {
    name: product.name,
    sku: product.sku,
    barcode: product.barcode ?? '',
    unit: product.unit,
    selling_price: String(product.selling_price),
    category_id: product.category_id,
    notes: product.notes ?? '',
  };
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  product,
  initialBarcode,
  categories,
  onDismiss,
  onSaved,
}) => {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const [scanError, setScanError] = useState<string | null>(null);
  const {
    control,
    handleSubmit,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  // Reload the form whenever it opens for a different product.
  useEffect(() => {
    if (isOpen) {
      reset(toFormValues(product, initialBarcode));
      setScanError(null);
    }
  }, [isOpen, product, initialBarcode, reset]);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    const input: ProductInput = {
      name: values.name,
      barcode: values.barcode || null,
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
        result === 'queued'
          ? 'Tanpa koneksi: perubahan disimpan dan akan disinkron otomatis.'
          : product
            ? 'Produk diperbarui.'
            : 'Produk ditambahkan.',
      );
    } catch (error) {
      setSubmitError(
        error instanceof ApiError
          ? error.details
            ? Object.values(error.details).flat().join(' ')
            : error.message
          : 'Gagal menyimpan produk.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleScan = async (applyValue: (value: string) => void) => {
    setScanError(null);
    try {
      const result = await scannerService.scan();
      if (result?.value) applyValue(result.value);
    } catch (error) {
      setScanError(error instanceof ScannerError ? error.message : 'Pemindaian gagal.');
    }
  };

  const errorMessage = submitError;

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>Batal</IonButton>
          </IonButtons>
          <IonTitle>{product ? 'Edit Produk' : 'Tambah Produk'}</IonTitle>
          <IonButtons slot="end">
            <IonButton strong onClick={handleSubmit(onSubmit)} disabled={submitting}>
              {submitting ? <IonSpinner name="dots" /> : 'Simpan'}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <form onSubmit={handleSubmit(onSubmit)}>
          <IonList>
            <IonItem>
              <Controller
                control={control}
                name="name"
                render={({ field, fieldState }) => (
                  <IonInput
                    label="Nama produk"
                    labelPlacement="stacked"
                    value={field.value}
                    onIonInput={(e) => field.onChange(e.detail.value ?? '')}
                    onIonBlur={field.onBlur}
                    errorText={fieldState.error?.message}
                    className={fieldState.invalid ? 'ion-invalid ion-touched' : ''}
                  />
                )}
              />
            </IonItem>

            <IonItem>
              <Controller
                control={control}
                name="sku"
                render={({ field, fieldState }) => (
                  <IonInput
                    label="SKU"
                    labelPlacement="stacked"
                    placeholder="Kosongkan untuk otomatis (PRD-xxxxxx)"
                    value={field.value}
                    onIonInput={(e) => field.onChange(e.detail.value ?? '')}
                    onIonBlur={field.onBlur}
                    errorText={fieldState.error?.message}
                    className={fieldState.invalid ? 'ion-invalid ion-touched' : ''}
                  />
                )}
              />
            </IonItem>

            <IonItem>
              <Controller
                control={control}
                name="barcode"
                render={({ field, fieldState }) => (
                  <>
                    <IonInput
                      label="Barcode"
                      labelPlacement="stacked"
                      placeholder="Opsional"
                      value={field.value}
                      onIonInput={(e) => field.onChange(e.detail.value ?? '')}
                      onIonBlur={field.onBlur}
                      errorText={fieldState.error?.message}
                      className={fieldState.invalid ? 'ion-invalid ion-touched' : ''}
                    />
                    <IonButton
                      slot="end"
                      fill="clear"
                      aria-label="Pindai barcode"
                      onClick={() => handleScan(field.onChange)}
                    >
                      <IonIcon slot="icon-only" icon={barcodeOutline} />
                    </IonButton>
                  </>
                )}
              />
            </IonItem>

            <IonItem>
              <Controller
                control={control}
                name="unit"
                render={({ field, fieldState }) => (
                  <IonInput
                    label="Satuan"
                    labelPlacement="stacked"
                    placeholder="pcs"
                    value={field.value}
                    onIonInput={(e) => field.onChange(e.detail.value ?? '')}
                    onIonBlur={field.onBlur}
                    errorText={fieldState.error?.message}
                    className={fieldState.invalid ? 'ion-invalid ion-touched' : ''}
                  />
                )}
              />
            </IonItem>

            <IonItem>
              <Controller
                control={control}
                name="selling_price"
                render={({ field, fieldState }) => (
                  <IonInput
                    type="number"
                    inputmode="numeric"
                    label="Harga jual (Rp)"
                    labelPlacement="stacked"
                    value={field.value}
                    onIonInput={(e) => field.onChange(e.detail.value ?? '')}
                    onIonBlur={field.onBlur}
                    errorText={fieldState.error?.message}
                    className={fieldState.invalid ? 'ion-invalid ion-touched' : ''}
                  />
                )}
              />
            </IonItem>

            <IonItem>
              <Controller
                control={control}
                name="category_id"
                render={({ field }) => (
                  <IonSelect
                    label="Kategori"
                    labelPlacement="stacked"
                    value={field.value}
                    onIonChange={(e) => field.onChange(e.detail.value ?? null)}
                  >
                    <IonSelectOption value={null}>Tanpa kategori</IonSelectOption>
                    {categories.map((category) => (
                      <IonSelectOption key={category.id} value={category.id}>
                        {category.name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                )}
              />
            </IonItem>

            <IonItem>
              <Controller
                control={control}
                name="notes"
                render={({ field }) => (
                  <IonTextarea
                    label="Catatan"
                    labelPlacement="stacked"
                    placeholder="Opsional"
                    autoGrow
                    value={field.value}
                    onIonInput={(e) => field.onChange(e.detail.value ?? '')}
                  />
                )}
              />
            </IonItem>
          </IonList>

          {errorMessage && (
            <IonNote color="danger" className="ion-padding-vertical ion-display-block">
              {errorMessage}
            </IonNote>
          )}

          {scanError && (
            <IonNote color="warning" className="ion-padding-vertical ion-display-block">
              {scanError}
            </IonNote>
          )}

          {!online && (
            <IonNote color="warning" className="ion-padding-vertical ion-display-block">
              Tanpa koneksi. Perubahan disimpan di perangkat dan disinkron otomatis saat online
              kembali.
            </IonNote>
          )}

          {/* Enables submit via the keyboard. */}
          <button type="submit" style={{ display: 'none' }} aria-hidden="true" />
        </form>
      </IonContent>
    </IonModal>
  );
};

export default ProductFormModal;
