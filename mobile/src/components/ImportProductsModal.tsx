import { useRef, useState } from 'react';
import { IonContent, IonIcon, IonModal, IonNote, IonSpinner } from '@ionic/react';
import {
  checkmarkCircleOutline,
  cloudUploadOutline,
  documentAttachOutline,
} from 'ionicons/icons';
import { useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../api/products';
import { ApiError } from '../lib/http';
import { formatRupiah } from '../lib/format';
import { buildImport, MAX_ROWS } from '../lib/import/buildImport';
import { readImportFile } from '../lib/import/parseFile';
import type { ImportIssue, ImportResult, PreparedImport } from '../lib/import/types';
import { categoryKeys, productKeys } from '../lib/queryKeys';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import PageHeader from './PageHeader';

/** Which screen of the flow is on show. */
type Step = 'pilih' | 'tinjau' | 'hasil';

interface ImportProductsModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  /** Called once an import has run, so the catalog can be refreshed. */
  onImported: (message: string) => void;
}

const IssueList: React.FC<{ issues: ImportIssue[] }> = ({ issues }) => (
  <div className="card card--tight import-issues">
    <ul>
      {issues.map((issue) => (
        <li key={`${issue.row}-${issue.message}`}>
          <span className="import-issues__row">Baris {issue.row}</span>
          {issue.name && <span className="import-issues__name">{issue.name}</span>}
          <span className="import-issues__message">{issue.message}</span>
        </li>
      ))}
    </ul>
  </div>
);

/**
 * Impor Produk — isi katalog dari berkas Excel.
 *
 * Berkasnya dibaca di dalam aplikasi, ditinjau dulu sebelum dikirim, lalu
 * server yang memutuskan: mana yang dibuat, mana yang diperbarui, dan baris
 * mana yang dilewati beserta alasannya.
 */
const ImportProductsModal: React.FC<ImportProductsModalProps> = ({
  isOpen,
  onDismiss,
  onImported,
}) => {
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const fileInput = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('pilih');
  const [fileName, setFileName] = useState('');
  const [prepared, setPrepared] = useState<PreparedImport | null>(null);
  const [mode, setMode] = useState<'create' | 'upsert'>('create');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const close = () => {
    setStep('pilih');
    setFileName('');
    setPrepared(null);
    setMode('create');
    setResult(null);
    setMessage(null);
    setSaving(false);
    onDismiss();
  };

  const pick = async (file: File | undefined) => {
    if (!file) return;

    setMessage(null);

    try {
      const parsed = buildImport(await readImportFile(file));

      if (parsed.header === null) {
        setPrepared(null);
        setMessage('Kolom berkas tidak dikenali. Pastikan ada kolom "Nama" dan "Harga".');
        return;
      }

      if (parsed.rows.length > MAX_ROWS) {
        setPrepared(null);
        setMessage(
          `Terlalu banyak baris: ${parsed.rows.length} produk. Maksimal ${MAX_ROWS} per berkas.`,
        );
        return;
      }

      setFileName(file.name);
      setPrepared(parsed);
      setStep('tinjau');
    } catch {
      setPrepared(null);
      setMessage('Berkas tidak bisa dibaca. Pastikan berkas .xlsx atau .csv dan tidak rusak.');
    }
  };

  const submit = async () => {
    if (prepared === null || prepared.rows.length === 0) return;

    if (!online) {
      setMessage('Impor butuh koneksi internet. Coba lagi setelah tersambung.');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const { data } = await productsApi.importRows(prepared.rows, mode);

      setResult(data);
      setStep('hasil');

      // The catalog and the category chips both may have grown.
      await queryClient.invalidateQueries({ queryKey: productKeys.all });
      await queryClient.invalidateQueries({ queryKey: categoryKeys.all });

      onImported(describeResult(data));
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : 'Impor gagal. Coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={close}>
      <IonContent>
        <PageHeader title="Impor Produk" onBack={close} />

        <div className="screen">
          {step === 'pilih' && (
            <>
              <div className="card import-card">
                <span className="import-card__icon" aria-hidden="true">
                  <IonIcon icon={documentAttachOutline} />
                </span>
                <p className="import-card__title">Pilih berkas Excel</p>
                <p className="field__hint">
                  Berkas .xlsx atau .csv — satu baris untuk satu produk.
                </p>

                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => fileInput.current?.click()}
                >
                  <IonIcon icon={cloudUploadOutline} aria-hidden="true" /> Pilih berkas
                </button>

                <input
                  ref={fileInput}
                  type="file"
                  accept=".xlsx,.csv"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    // Let the same file be picked again after a mistake.
                    event.target.value = '';
                    void pick(file);
                  }}
                />
              </div>

              <div className="card card--tight">
                <p className="import-card__title">Kolom yang dikenali</p>
                <div className="import-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Nama</th>
                        <th>SKU</th>
                        <th>Satuan</th>
                        <th>Harga</th>
                        <th>Kategori</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Indomie</td>
                        <td>8991002102006</td>
                        <td>pcs</td>
                        <td>3000</td>
                        <td>Makanan</td>
                      </tr>
                      <tr>
                        <td>Teh Kotak</td>
                        <td />
                        <td>pcs</td>
                        <td>5000</td>
                        <td>Minuman</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="field__hint">
                  Wajib <strong>Nama</strong> dan <strong>Harga</strong>. SKU yang kosong dibuat
                  otomatis, dan kategori yang belum ada ikut dibuat.
                </p>
              </div>
            </>
          )}

          {step === 'tinjau' && prepared && (
            <>
              <div className="card">
                <p className="import-summary">{prepared.rows.length} produk siap diimpor</p>
                <p className="field__hint">
                  {prepared.total} baris terbaca dari {fileName}
                  {prepared.issues.length > 0 &&
                    ` · ${prepared.issues.length} baris dilewati`}
                </p>
              </div>

              {prepared.issues.length > 0 && <IssueList issues={prepared.issues} />}

              {prepared.rows.length > 0 && (
                <div className="card card--tight">
                  <p className="import-card__title">Contoh isi</p>
                  <ul className="import-preview">
                    {prepared.rows.slice(0, 5).map((row) => (
                      <li key={row.row}>
                        <span className="import-preview__name">{row.name}</span>
                        <span className="import-preview__meta">
                          {row.sku ?? 'SKU otomatis'} · {formatRupiah(row.selling_price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {prepared.rows.length > 5 && (
                    <p className="field__hint">
                      dan {prepared.rows.length - 5} baris lain tidak ditampilkan.
                    </p>
                  )}
                </div>
              )}

              <label className="card card--tight import-toggle">
                <input
                  type="checkbox"
                  checked={mode === 'upsert'}
                  onChange={(event) => setMode(event.target.checked ? 'upsert' : 'create')}
                />
                <span>
                  <span className="import-toggle__title">Perbarui produk yang sudah ada</span>
                  <span className="field__hint">
                    Tanpa ini, baris yang produknya sudah ada hanya dilewati — harga lamanya tidak
                    berubah.
                  </span>
                </span>
              </label>

              <div className="btn-row">
                <button type="button" className="btn btn--plain" onClick={close}>
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={saving || !online || prepared.rows.length === 0}
                  onClick={() => void submit()}
                >
                  {saving ? (
                    <IonSpinner name="dots" />
                  ) : (
                    `Impor ${prepared.rows.length} produk`
                  )}
                </button>
              </div>

              {!online && (
                <IonNote className="note note--warn">
                  Impor butuh koneksi internet supaya harga dan kode diperiksa server.
                </IonNote>
              )}
            </>
          )}

          {step === 'hasil' && result && (
            <>
              <div className="card import-card">
                <span className="import-card__icon import-card__icon--done" aria-hidden="true">
                  <IonIcon icon={checkmarkCircleOutline} />
                </span>
                <p className="import-summary">{describeResult(result)}</p>
                {result.categories_created.length > 0 && (
                  <p className="field__hint">
                    Kategori baru: {result.categories_created.join(', ')}
                  </p>
                )}
              </div>

              {result.issues.length > 0 && (
                <>
                  <p className="field__label">{result.issues.length} baris dilewati</p>
                  <IssueList issues={result.issues} />
                </>
              )}

              <button type="button" className="btn btn--primary" onClick={close}>
                Selesai
              </button>
            </>
          )}

          {message && <IonNote className="note note--error">{message}</IonNote>}
        </div>
      </IonContent>
    </IonModal>
  );
};

/** "12 produk baru, 3 diperbarui, 2 dilewati". */
function describeResult(result: ImportResult): string {
  const parts = [`${result.created} produk baru`];

  if (result.updated > 0) parts.push(`${result.updated} diperbarui`);
  if (result.skipped > 0) parts.push(`${result.skipped} dilewati`);

  return parts.join(', ');
}

export default ImportProductsModal;
