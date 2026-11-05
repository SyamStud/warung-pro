import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonNote,
  IonPage,
  IonSpinner,
  useIonToast,
} from '@ionic/react';
import { printOutline, scanOutline, swapHorizontalOutline } from 'ionicons/icons';
import PageHeader from '../components/PageHeader';
import PrinterSettingsModal from '../components/PrinterSettingsModal';
import { PAPER_COLUMNS, PAPER_WIDTHS, type PaperWidth } from '../lib/receipt';
import { digitsOnly, formatThousands } from '../lib/format';
import {
  isTransferReceiptUsable,
  type TransferReceiptData,
} from '../lib/transfer/types';
import { parseTransferReceipt } from '../lib/transfer/parse';
import { useShareInbox } from '../share/useShareInbox';
import { isTextRecognitionSupported, recognizeImageText } from '../services/ocr';
import {
  DEFAULT_PRINTER_SETTINGS,
  PrinterError,
  TRANSPORT_LABELS,
  isPrintingSupported,
  loadPrinterSettings,
  previewTransferReceipt,
  printTransferReceipt,
  savePrinterSettings,
  type PrinterSettings,
} from '../services/printer';

interface TransferForm {
  provider: string;
  providerKind: TransferReceiptData['providerKind'];
  date: string;
  time: string;
  amount: string;
  status: string;
  transactionType: string;
  destinationName: string;
  destinationBank: string;
  destinationAccount: string;
  sourceName: string;
  sourceAccount: string;
  paymentMethod: string;
  adminFee: string;
  reference: string;
  referenceLabel: string;
  orderId: string;
  orderLabel: string;
}

const EMPTY_FORM: TransferForm = {
  provider: '',
  providerKind: 'unknown',
  date: '',
  time: '',
  amount: '',
  status: '',
  transactionType: '',
  destinationName: '',
  destinationBank: '',
  destinationAccount: '',
  sourceName: '',
  sourceAccount: '',
  paymentMethod: '',
  adminFee: '',
  reference: '',
  referenceLabel: '',
  orderId: '',
  orderLabel: '',
};

function toForm(data: TransferReceiptData): TransferForm {
  return {
    provider: data.provider,
    providerKind: data.providerKind,
    date: data.date,
    time: data.time,
    amount: data.amount > 0 ? formatThousands(String(data.amount)) : '',
    status: data.status,
    transactionType: data.transactionType,
    destinationName: data.destinationName,
    destinationBank: data.destinationBank,
    destinationAccount: data.destinationAccount,
    sourceName: data.sourceName,
    sourceAccount: data.sourceAccount,
    paymentMethod: data.paymentMethod,
    adminFee: data.adminFee > 0 ? formatThousands(String(data.adminFee)) : '',
    reference: data.reference,
    referenceLabel: data.referenceLabel,
    orderId: data.orderId,
    orderLabel: data.orderLabel,
  };
}

function toData(form: TransferForm): TransferReceiptData {
  return {
    provider: form.provider.trim(),
    providerKind: form.providerKind,
    date: form.date.trim(),
    time: form.time.trim(),
    amount: Number(digitsOnly(form.amount)) || 0,
    status: form.status.trim(),
    transactionType: form.transactionType.trim(),
    destinationName: form.destinationName.trim(),
    destinationBank: form.destinationBank.trim(),
    destinationAccount: form.destinationAccount.trim(),
    sourceName: form.sourceName.trim(),
    sourceAccount: form.sourceAccount.trim(),
    paymentMethod: form.paymentMethod.trim(),
    adminFee: Number(digitsOnly(form.adminFee)) || 0,
    reference: form.reference.trim(),
    referenceLabel: form.referenceLabel.trim() || 'No. Referensi',
    orderId: form.orderId.trim(),
    orderLabel: form.orderLabel.trim(),
  };
}

/**
 * Struk Transfer — turns a screenshot of a bank transfer proof into the text
 * receipt a thermal printer can produce, headed by the warung's name.
 *
 * The screenshot is read on-device with ML Kit. Every field stays editable so
 * a misread digit never silently ends up on a receipt.
 */
const TransferReceipt: React.FC = () => {
  const [presentToast] = useIonToast();
  const { photos } = useShareInbox();
  const photo = photos[0];

  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
  const [form, setForm] = useState<TransferForm>(EMPTY_FORM);
  const [rawText, setRawText] = useState('');
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const autoRead = useRef('');

  const native = isPrintingSupported();

  useEffect(() => {
    let alive = true;

    void loadPrinterSettings().then((loaded) => {
      if (alive) setSettings(loaded);
    });

    return () => {
      alive = false;
    };
  }, []);

  const applyData = useCallback((data: TransferReceiptData) => {
    if (
      data.amount > 0 ||
      data.reference ||
      data.destinationAccount ||
      data.destinationName
    ) {
      setForm(toForm(data));
    }
  }, []);

  const readFromImage = useCallback(async () => {
    if (!photo?.path) {
      setReadError(
        isTextRecognitionSupported()
          ? 'Gambar ini tidak punya berkas yang bisa dibaca. Isi datanya manual di bawah.'
          : 'Membaca tulisan dari gambar hanya tersedia di aplikasi Android. Isi datanya manual di bawah.',
      );
      return;
    }

    setReading(true);
    setReadError(null);

    try {
      const text = await recognizeImageText(photo.path);
      const data = parseTransferReceipt(text);

      setRawText(text);
      applyData(data);

      if (!isTransferReceiptUsable(data)) {
        setReadError(
          'Sebagian data tidak terbaca. Periksa kolom di bawah dan lengkapi manual bila perlu.',
        );
      }
    } catch (caught) {
      setReadError(
        caught instanceof Error
          ? caught.message
          : 'Tulisan di gambar tidak bisa dibaca. Isi datanya manual.',
      );
    } finally {
      setReading(false);
    }
  }, [photo, applyData]);

  // Read a freshly shared screenshot once; pressing "Baca ulang" forces it.
  useEffect(() => {
    if (!photo?.path || autoRead.current === photo.path) return;

    autoRead.current = photo.path;
    void readFromImage();
  }, [photo, readFromImage]);

  const data = useMemo(() => toData(form), [form]);
  const preview = useMemo(
    () => previewTransferReceipt(data, settings),
    [data, settings],
  );

  const set = <K extends keyof TransferForm>(key: K, value: TransferForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const changePaper = (paperWidth: PaperWidth) => {
    const next = { ...settings, paperWidth };

    setSettings(next);
    void savePrinterSettings(next);
  };

  const print = async () => {
    if (data.amount <= 0) {
      presentToast({
        message: 'Isi nominal transfer dulu.',
        duration: 2000,
        color: 'warning',
        position: 'top',
      });
      return;
    }

    if (!settings.printer) {
      setError('Belum ada printer. Pilih printer dulu di pengaturan.');
      setSettingsOpen(true);
      return;
    }

    setPrinting(true);
    setError(null);

    try {
      await printTransferReceipt(data, settings);
      presentToast({
        message: 'Struk transfer dikirim ke printer.',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
    } catch (caught) {
      const message =
        caught instanceof PrinterError ? caught.message : 'Gagal mencetak struk transfer.';
      setError(message);
      presentToast({ message, duration: 2500, color: 'danger', position: 'top' });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <IonPage>
      <IonContent>
        <PageHeader title="Struk Transfer" backHref="/tabs/home" />

        <div className="screen">
          {photo ? (
            <div className="card">
              <div className="transfer-photo">
                <img src={photo.url} alt={photo.name ?? 'Bukti transfer'} />
                <div className="transfer-photo__text">
                  <p className="card__title" style={{ marginBottom: 4 }}>
                    Bukti transfer
                  </p>
                  <p className="field__hint">
                    Tulisan di gambar dibaca otomatis di perangkat. Periksa lagi hasilnya sebelum
                    dicetak.
                  </p>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    style={{ marginTop: 10 }}
                    disabled={reading}
                    onClick={() => void readFromImage()}
                  >
                    {reading ? <IonSpinner name="dots" /> : <><IonIcon icon={scanOutline} /> Baca ulang</>}
                  </button>
                </div>
              </div>

              {reading && (
                <p className="field__hint" style={{ marginTop: 10 }}>
                  <IonSpinner name="dots" /> Membaca tulisan di gambar…
                </p>
              )}

              {readError && (
                <IonNote className="note note--warn" style={{ marginTop: 10 }}>
                  {readError}
                </IonNote>
              )}
            </div>
          ) : (
            <div className="card card--outline">
              <div className="transfer-photo__text">
                <p className="card__title" style={{ marginBottom: 4 }}>
                  <IonIcon icon={swapHorizontalOutline} /> Struk transfer manual
                </p>
                <p className="field__hint">
                  Belum ada gambar dibagikan. Isi data transfer di bawah, atau bagikan tangkapan
                  layar bukti transfer dari aplikasi bank maupun e-wallet (DANA, OVO, GoPay,
                  ShopeePay, dan sejenisnya) ke Warung POS.
                </p>
              </div>
            </div>
          )}

          <div className="card" style={{ marginTop: 12 }}>
            <h2 className="card__title" style={{ marginBottom: 12 }}>
              Data transfer
            </h2>

            <label className="field">
              <span className="field__label">Aplikasi / bank</span>
              <input
                className="input"
                value={form.provider}
                placeholder="BCA / DANA / BRI"
                onChange={(event) => set('provider', event.target.value)}
              />
            </label>

            <div className="transfer-grid">
              <label className="field">
                <span className="field__label">Tanggal</span>
                <input
                  className="input"
                  value={form.date}
                  placeholder="02/11/2026"
                  onChange={(event) => set('date', event.target.value)}
                />
              </label>

              <label className="field">
                <span className="field__label">Jam</span>
                <input
                  className="input"
                  value={form.time}
                  placeholder="01:38"
                  onChange={(event) => set('time', event.target.value)}
                />
              </label>
            </div>

            <label className="field">
              <span className="field__label">Nominal</span>
              <input
                className="input"
                inputMode="numeric"
                value={form.amount}
                placeholder="20.000"
                onChange={(event) => set('amount', formatThousands(event.target.value))}
              />
            </label>

            <div className="transfer-grid">
              <label className="field">
                <span className="field__label">Status</span>
                <input
                  className="input"
                  value={form.status}
                  placeholder="Berhasil"
                  onChange={(event) => set('status', event.target.value)}
                />
              </label>

              <label className="field">
                <span className="field__label">Jenis transaksi</span>
                <input
                  className="input"
                  value={form.transactionType}
                  placeholder="Transfer Bank"
                  onChange={(event) => set('transactionType', event.target.value)}
                />
              </label>
            </div>

            <label className="field">
              <span className="field__label">Nama tujuan / merchant / poket</span>
              <input
                className="input"
                value={form.destinationName}
                placeholder="DARURAT"
                onChange={(event) => set('destinationName', event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Bank tujuan (opsional)</span>
              <input
                className="input"
                value={form.destinationBank}
                placeholder="BANK BRI"
                onChange={(event) => set('destinationBank', event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Akun / no. rekening tujuan</span>
              <input
                className="input"
                value={form.destinationAccount}
                placeholder="888 - 001 - 082 - 6007 - 1401"
                onChange={(event) => set('destinationAccount', event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Nama pengirim (opsional)</span>
              <input
                className="input"
                value={form.sourceName}
                placeholder="VINA VEBRIANTI"
                onChange={(event) => set('sourceName', event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Sumber dana / rekening pengirim</span>
              <input
                className="input"
                value={form.sourceAccount}
                placeholder="108 - 2** - **14"
                onChange={(event) => set('sourceAccount', event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Metode pembayaran (opsional)</span>
              <input
                className="input"
                value={form.paymentMethod}
                placeholder="Saldo DANA (SmartPay)"
                onChange={(event) => set('paymentMethod', event.target.value)}
              />
            </label>

            <label className="field">
              <span className="field__label">Biaya admin (opsional)</span>
              <input
                className="input"
                inputMode="numeric"
                value={form.adminFee}
                placeholder="0"
                onChange={(event) => set('adminFee', formatThousands(event.target.value))}
              />
            </label>

            <label className="field">
              <span className="field__label">
                {form.referenceLabel || 'No. referensi / ID transaksi'}
              </span>
              <textarea
                className="input"
                rows={3}
                value={form.reference}
                placeholder="9567120261102013856"
                onChange={(event) => set('reference', event.target.value)}
              />
              <span className="field__hint">Boleh lebih dari satu baris.</span>
            </label>

            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field__label">
                {form.orderLabel || 'ID order / merchant (opsional)'}
              </span>
              <input
                className="input"
                value={form.orderId}
                placeholder="1f11667b-92a3-4313-83ae-aa8d15795ddc"
                onChange={(event) => set('orderId', event.target.value)}
              />
            </label>
          </div>

          {rawText && (
            <div className="card card--outline" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--plain btn--sm"
                onClick={() => setShowRaw((current) => !current)}
              >
                {showRaw ? 'Sembunyikan tulisan terdeteksi' : 'Lihat tulisan terdeteksi'}
              </button>
              {showRaw && (
                <pre className="transfer-preview" style={{ marginTop: 10 }}>
                  {rawText}
                </pre>
              )}
            </div>
          )}

          <div className="card" style={{ marginTop: 12 }}>
            <div className="transfer-preview-head">
              <h2 className="card__title" style={{ marginBottom: 0 }}>
                Pratinjau struk
              </h2>
              <select
                className="input transfer-preview__paper"
                value={settings.paperWidth}
                aria-label="Lebar kertas"
                onChange={(event) => changePaper(event.target.value as PaperWidth)}
              >
                {PAPER_WIDTHS.map((width) => (
                  <option key={width} value={width}>
                    {width} mm · {PAPER_COLUMNS[width]} kolom
                  </option>
                ))}
              </select>
            </div>
            <pre className="transfer-preview">{preview}</pre>
          </div>

          <div className="card card--outline" style={{ marginTop: 12 }}>
            <div className="print-image__printer">
              <div>
                <p className="field__label" style={{ marginBottom: 2 }}>
                  Printer
                </p>
                <p className="print-image__printer-name">
                  {settings.printer
                    ? `${settings.printer.label} · ${TRANSPORT_LABELS[settings.printer.transport]}`
                    : 'Belum dipilih'}
                </p>
              </div>
              <button
                type="button"
                className="btn btn--outline btn--sm"
                onClick={() => setSettingsOpen(true)}
              >
                Pengaturan
              </button>
            </div>
          </div>

          {!native && (
            <IonNote className="note note--warn" style={{ marginTop: 12 }}>
              Pencetakan hanya tersedia di aplikasi Android. Di browser, struk tampil sebagai
              pratinjau.
            </IonNote>
          )}

          {error && (
            <IonNote className="note note--error" style={{ marginTop: 12 }}>
              {error}
            </IonNote>
          )}

          <button
            type="button"
            className="btn btn--primary"
            style={{ marginTop: 16 }}
            disabled={printing || !native}
            onClick={() => void print()}
          >
            {printing ? (
              <IonSpinner name="dots" />
            ) : (
              <>
                <IonIcon icon={printOutline} /> Cetak Struk Transfer
              </>
            )}
          </button>
        </div>
      </IonContent>

      <PrinterSettingsModal
        isOpen={settingsOpen}
        onDismiss={() => {
          setSettingsOpen(false);
          void loadPrinterSettings().then(setSettings);
        }}
      />
    </IonPage>
  );
};

export default TransferReceipt;
