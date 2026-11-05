import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IonContent,
  IonIcon,
  IonNote,
  IonPage,
  IonSpinner,
  useIonToast,
} from '@ionic/react';
import { imageOutline, imagesOutline, printOutline, swapHorizontalOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import PrinterSettingsModal from '../components/PrinterSettingsModal';
import {
  DEFAULT_IMAGE_TONE,
  PAPER_DOTS,
  PAPER_WIDTHS,
  type PaperWidth,
} from '../lib/receipt';
import { useShareInbox } from '../share/useShareInbox';
import { inspectImage, printImage } from '../services/imagePrint';
import { loadImageTone, saveImageTone } from '../services/imageSettings';
import {
  DEFAULT_PRINTER_SETTINGS,
  PrinterError,
  TRANSPORT_LABELS,
  isPrintingSupported,
  loadPrinterSettings,
  savePrinterSettings,
  type PrinterSettings,
} from '../services/printer';

interface PaperSize {
  width: number;
  height: number;
}

/**
 * Cetak Gambar — prints screenshots sent from other apps (bank mutations,
 * payment proofs, ...) on the thermal printer.
 *
 * A share lands here automatically and prints without further taps when a
 * printer is already configured; otherwise the page asks for one.
 */
const PrintImage: React.FC = () => {
  const [presentToast] = useIonToast();
  const navigate = useNavigate();
  const { photos, autoPrint, addPhotos, removePhoto, clearPhotos, acknowledgeAutoPrint } =
    useShareInbox();

  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
  const [settingsReady, setSettingsReady] = useState(false);
  const [tone, setTone] = useState(DEFAULT_IMAGE_TONE);
  const [toneReady, setToneReady] = useState(false);
  const [paperSize, setPaperSize] = useState<PaperSize | null>(null);
  const [inspectedUrl, setInspectedUrl] = useState('');
  const [printing, setPrinting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoPrinted = useRef('');
  const toneDetectedFor = useRef('');

  const native = isPrintingSupported();

  useEffect(() => {
    let alive = true;

    void Promise.all([loadPrinterSettings(), loadImageTone()]).then(([loadedSettings, savedTone]) => {
      if (!alive) return;

      setSettings(loadedSettings);
      setSettingsReady(true);
      setTone((current) => ({
        ...current,
        threshold: savedTone.threshold,
        dither: savedTone.dither,
      }));
      setToneReady(true);
    });

    return () => {
      alive = false;
    };
  }, []);

  // Remember the print quality between shares. Debounced so dragging the
  // slider does not write to storage on every pixel.
  useEffect(() => {
    if (!toneReady) return;

    const timer = setTimeout(() => {
      void saveImageTone({ threshold: tone.threshold, dither: tone.dither });
    }, 400);

    return () => clearTimeout(timer);
  }, [toneReady, tone.threshold, tone.dither]);

  // Measure the first picture so the user knows how much paper it will use,
  // and guess its theme so dark-mode screenshots are inverted automatically.
  useEffect(() => {
    const photo = photos[0];

    if (!photo) {
      setPaperSize(null);
      return;
    }

    let alive = true;

    void inspectImage(photo.url, settings.paperWidth)
      .then((inspection) => {
        if (!alive) return;

        setPaperSize({ width: inspection.widthDots, height: inspection.heightDots });
        setInspectedUrl(photo.url);

        // Detect the theme once per picture; changing paper width or flipping
        // the switch by hand must not be overwritten on every render.
        if (toneDetectedFor.current !== photo.url) {
          toneDetectedFor.current = photo.url;
          setTone((current) => ({ ...current, invert: inspection.dark }));
        }
      })
      .catch(() => {
        if (!alive) return;

        setPaperSize(null);
        // Let the direct-print flow continue so the real error is shown.
        setInspectedUrl(photo.url);
      });

    return () => {
      alive = false;
    };
  }, [photos, settings.paperWidth]);

  const printAll = useCallback(async () => {
    if (photos.length === 0) return;

    if (!settings.printer) {
      setError('Belum ada printer. Pilih printer dulu di pengaturan.');
      setSettingsOpen(true);
      return;
    }

    setPrinting(true);
    setError(null);

    try {
      for (const photo of photos) {
        await printImage(photo.url, settings, tone);
      }

      presentToast({
        message:
          photos.length > 1
            ? `${photos.length} gambar dikirim ke printer.`
            : 'Gambar dikirim ke printer.',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
    } catch (caught) {
      const message = caught instanceof PrinterError ? caught.message : 'Gagal mencetak gambar.';
      setError(message);
      presentToast({ message, duration: 2500, color: 'danger', position: 'top' });
    } finally {
      setPrinting(false);
    }
  }, [photos, settings, tone, presentToast]);

  // Direct print: a share should not need another tap when everything is set up.
  useEffect(() => {
    if (!autoPrint || !settingsReady || !toneReady || photos.length === 0) return;

    // Wait for the tone inspection so a dark screenshot is not printed as a
    // black block by the default (light) settings.
    if (inspectedUrl !== photos[0].url) return;

    const signature = photos.map((photo) => photo.url).join('|');

    if (autoPrinted.current === signature) return;

    autoPrinted.current = signature;
    acknowledgeAutoPrint();
    void printAll();
  }, [
    autoPrint,
    settingsReady,
    toneReady,
    inspectedUrl,
    photos,
    acknowledgeAutoPrint,
    printAll,
  ]);

  const changePaper = (paperWidth: PaperWidth) => {
    const next = { ...settings, paperWidth };

    setSettings(next);
    void savePrinterSettings(next);
  };

  const chooseFiles = (files: FileList | null) => {
    if (!files) return;

    const picked = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        url: URL.createObjectURL(file),
        name: file.name,
        revocable: true,
      }));

    if (picked.length === 0) {
      presentToast({
        message: 'Pilih berkas gambar.',
        duration: 2000,
        color: 'warning',
        position: 'top',
      });
      return;
    }

    addPhotos(picked);
  };

  return (
    <IonPage>
      <IonContent>
        <PageHeader title="Cetak Gambar" backHref="/tabs/home" />

        <div className="screen">
          {photos.length === 0 ? (
            <div className="card empty-state">
              <IonIcon className="empty-state__icon" icon={imagesOutline} />
              <p className="empty-state__title">Belum ada gambar</p>
              <p className="empty-state__text">
                Pilih gambar di sini, atau dari aplikasi lain buka menu Bagikan lalu pilih
                Warung POS untuk langsung mencetaknya.
              </p>
              <button
                type="button"
                className="btn btn--primary"
                style={{ marginTop: 16 }}
                onClick={() => fileInputRef.current?.click()}
              >
                <IonIcon icon={imageOutline} /> Pilih Gambar
              </button>
            </div>
          ) : (
            <>
              <div className="print-image-list">
                {photos.map((photo, index) => (
                  <figure className="print-image" key={photo.url}>
                    <img src={photo.url} alt={photo.name ?? `Gambar ${index + 1}`} />
                    <button
                      type="button"
                      className="print-image__remove"
                      aria-label={`Hapus ${photo.name ?? `gambar ${index + 1}`}`}
                      onClick={() => removePhoto(index)}
                    >
                      ×
                    </button>
                  </figure>
                ))}
              </div>

              {paperSize && (
                <p className="field__hint" style={{ marginTop: 8 }}>
                  {photos.length > 1 ? 'Gambar pertama: ' : ''}
                  {paperSize.width} × {paperSize.height} titik · ±{Math.round(paperSize.height / 8)} cm
                  kertas
                </p>
              )}

              <div className="card" style={{ marginTop: 12 }}>
                <h2 className="card__title" style={{ marginBottom: 12 }}>
                  Hasil cetak
                </h2>

                <label className="field">
                  <span className="field__label">Lebar kertas</span>
                  <select
                    className="input"
                    value={settings.paperWidth}
                    onChange={(event) => changePaper(event.target.value as PaperWidth)}
                  >
                    {PAPER_WIDTHS.map((width) => (
                      <option key={width} value={width}>
                        {width} mm · {PAPER_DOTS[width]} titik
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span className="field__label">Kegelapan (ambang {tone.threshold})</span>
                  <input
                    className="print-image__range"
                    type="range"
                    min={40}
                    max={230}
                    step={5}
                    value={tone.threshold}
                    onChange={(event) =>
                      setTone((current) => ({ ...current, threshold: Number(event.target.value) }))
                    }
                  />
                  <span className="field__hint">
                    Naikkan bila tulisan pudar, turunkan bila hasilnya terlalu tebal atau hitam.
                  </span>
                </label>

                <label className="print-image__check">
                  <input
                    type="checkbox"
                    checked={tone.dither}
                    onChange={(event) =>
                      setTone((current) => ({ ...current, dither: event.target.checked }))
                    }
                  />
                  <span>
                    Haluskan foto (dithering)
                    <span className="field__hint">
                      Cocok untuk foto; untuk tangkapan layar teks hasilnya lebih tajam bila mati.
                    </span>
                  </span>
                </label>

                <label className="print-image__check" style={{ marginTop: 14 }}>
                  <input
                    type="checkbox"
                    checked={tone.invert}
                    onChange={(event) =>
                      setTone((current) => ({ ...current, invert: event.target.checked }))
                    }
                  />
                  <span>
                    Cetak terbalik (latar gelap)
                    <span className="field__hint">
                      Otomatis aktif untuk tangkapan layar mode gelap agar tulisan tetap hitam.
                    </span>
                  </span>
                </label>
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
                  Pencetakan hanya tersedia di aplikasi Android.
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
                disabled={printing}
                onClick={() => void printAll()}
              >
                {printing ? (
                  <IonSpinner name="dots" />
                ) : (
                  <>
                    <IonIcon icon={printOutline} /> Cetak {photos.length > 1 ? `${photos.length} Gambar` : 'Gambar'}
                  </>
                )}
              </button>

              <button
                type="button"
                className="btn btn--outline"
                style={{ marginTop: 12 }}
                onClick={() => {
                  acknowledgeAutoPrint();
                  navigate('/tabs/transfer');
                }}
              >
                <IonIcon icon={swapHorizontalOutline} /> Jadikan Struk Transfer (teks)
              </button>

              <p className="field__hint" style={{ marginTop: 8 }}>
                Khusus bukti transfer bank atau e-wallet: nominal, tujuan dan nomor referensi
                dibaca dari gambar, lalu dicetak sebagai struk teks dengan nama warung.
              </p>

              <div className="btn-row" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn--plain"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Pilih Gambar
                </button>
                <button type="button" className="btn btn--quiet" onClick={clearPhotos}>
                  Kosongkan
                </button>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              chooseFiles(event.target.files);
              event.target.value = '';
            }}
          />
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

export default PrintImage;
