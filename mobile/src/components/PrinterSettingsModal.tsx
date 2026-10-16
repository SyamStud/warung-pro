import { useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
import { printOutline, searchOutline } from 'ionicons/icons';
import type { PrinterDevice } from '@devlas/capacitor-thermal-printer';
import { PAPER_LABELS, PAPER_WIDTHS } from '../lib/receipt';
import {
  DEFAULT_PRINTER_SETTINGS,
  PrinterError,
  TRANSPORT_LABELS,
  isPrintingSupported,
  listPrintDevices,
  loadPrinterSettings,
  savePrinterSettings,
  savedPrinterFromDevice,
  testPrint,
  type PrinterSettings,
  type PrinterTransportKind,
  type SavedPrinter,
} from '../services/printer';

interface PrinterSettingsModalProps {
  isOpen: boolean;
  onDismiss: () => void;
}

const TRANSPORTS: PrinterTransportKind[] = ['bluetooth', 'usb', 'tcp'];

function deviceKey(device: PrinterDevice): string {
  return device.transport === 'usb'
    ? `usb:${device.vendorId}:${device.productId}`
    : `bt:${device.address}`;
}

function printerKey(printer: SavedPrinter | null): string {
  if (!printer) return '';
  if (printer.transport === 'usb') return `usb:${printer.vendorId}:${printer.productId}`;
  if (printer.transport === 'bluetooth') return `bt:${printer.address}`;
  return `tcp:${printer.host}:${printer.port}`;
}

function deviceLabel(device: PrinterDevice): string {
  if (device.transport === 'usb') {
    return `${device.name ?? 'Printer USB'} (${device.vendorId}:${device.productId})`;
  }
  return `${device.name ?? 'Printer Bluetooth'} · ${device.address}`;
}

/** Printer + receipt paper settings (58mm / 80mm, Bluetooth / USB / WiFi). */
const PrinterSettingsModal: React.FC<PrinterSettingsModalProps> = ({ isOpen, onDismiss }) => {
  const [presentToast] = useIonToast();
  const native = isPrintingSupported();

  const [settings, setSettings] = useState<PrinterSettings>(DEFAULT_PRINTER_SETTINGS);
  const [transport, setTransport] = useState<PrinterTransportKind>('bluetooth');
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [listing, setListing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setDevices([]);
    void loadPrinterSettings().then((loaded) => {
      setSettings(loaded);
      setTransport(loaded.printer?.transport ?? 'bluetooth');
    });
  }, [isOpen]);

  const chooseTransport = (next: PrinterTransportKind) => {
    setTransport(next);
    setDevices([]);
    setError(null);
    setSettings((current) => {
      if (next === 'tcp') {
        return {
          ...current,
          printer: {
            transport: 'tcp',
            label: 'WiFi / LAN',
            host: current.printer?.host ?? '',
            port: current.printer?.port ?? 9100,
          },
        };
      }
      return {
        ...current,
        printer: current.printer?.transport === next ? current.printer : null,
      };
    });
  };

  const searchDevices = async () => {
    setListing(true);
    setError(null);
    try {
      const found = await listPrintDevices(transport === 'usb' ? 'usb' : 'bluetooth');
      setDevices(found);
      if (found.length === 0) {
        setError('Tidak ada perangkat ditemukan. Pasangkan printer di pengaturan sistem dulu.');
      }
    } catch (caught) {
      setError(caught instanceof PrinterError ? caught.message : 'Gagal mencari perangkat.');
    } finally {
      setListing(false);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await savePrinterSettings(settings);
      presentToast({ message: 'Pengaturan printer disimpan.', duration: 2000, color: 'success' });
      onDismiss();
    } catch {
      setError('Gagal menyimpan pengaturan.');
    } finally {
      setBusy(false);
    }
  };

  const runTestPrint = async () => {
    setBusy(true);
    setError(null);
    try {
      await testPrint(settings);
      presentToast({ message: 'Cetak uji dikirim ke printer.', duration: 2000, color: 'success' });
    } catch (caught) {
      setError(caught instanceof PrinterError ? caught.message : 'Cetak uji gagal.');
    } finally {
      setBusy(false);
    }
  };

  const selectedKey = printerKey(settings.printer);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss}>
      <IonHeader className="app-header">
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>Tutup</IonButton>
          </IonButtons>
          <IonTitle className="app-title-bar">Pengaturan Printer</IonTitle>
          <IonButtons slot="end">
            <IonButton strong disabled={busy} onClick={save}>
              {busy ? <IonSpinner name="dots" /> : 'Simpan'}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="screen">
          {!native && (
            <p className="note note--warn">
              Pencetakan hanya tersedia di aplikasi Android. Di browser, struk akan ditampilkan
              sebagai pratinjau.
            </p>
          )}

          <div className="card">
            <h2 className="card__title" style={{ marginBottom: 12 }}>
              Struk
            </h2>

            <label className="field">
              <span className="field__label">Lebar kertas</span>
              <select
                className="input"
                value={settings.paperWidth}
                onChange={(e) =>
                  setSettings((current) => ({
                    ...current,
                    paperWidth: e.target.value as PrinterSettings['paperWidth'],
                  }))
                }
              >
                {PAPER_WIDTHS.map((width) => (
                  <option key={width} value={width}>
                    {PAPER_LABELS[width]}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">Nama toko</span>
              <input
                className="input"
                value={settings.storeName}
                onChange={(e) =>
                  setSettings((current) => ({ ...current, storeName: e.target.value }))
                }
              />
            </label>

            <label className="field">
              <span className="field__label">Alamat (opsional)</span>
              <input
                className="input"
                value={settings.storeAddress}
                onChange={(e) =>
                  setSettings((current) => ({ ...current, storeAddress: e.target.value }))
                }
              />
            </label>

            <label className="field" style={{ marginBottom: 0 }}>
              <span className="field__label">Footer (opsional)</span>
              <input
                className="input"
                value={settings.footer}
                onChange={(e) =>
                  setSettings((current) => ({ ...current, footer: e.target.value }))
                }
              />
            </label>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <h2 className="card__title" style={{ marginBottom: 12 }}>
              Koneksi printer
            </h2>

            <div className="segmented" role="tablist" aria-label="Jenis koneksi">
              {TRANSPORTS.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="tab"
                  aria-selected={transport === kind}
                  className={`segmented__option${
                    transport === kind ? ' segmented__option--active' : ''
                  }`}
                  style={{ fontSize: 13 }}
                  onClick={() => chooseTransport(kind)}
                >
                  {TRANSPORT_LABELS[kind]}
                </button>
              ))}
            </div>

            {transport === 'tcp' ? (
              <div className="field__row" style={{ gap: 12, marginTop: 14 }}>
                <label className="field" style={{ flex: 2, marginBottom: 0 }}>
                  <span className="field__label">Alamat IP / host</span>
                  <input
                    className="input"
                    placeholder="192.168.1.50"
                    value={settings.printer?.host ?? ''}
                    onChange={(e) =>
                      setSettings((current) => ({
                        ...current,
                        printer: {
                          transport: 'tcp',
                          label: 'WiFi / LAN',
                          host: e.target.value,
                          port: current.printer?.port ?? 9100,
                        },
                      }))
                    }
                  />
                </label>
                <label className="field" style={{ flex: 1, marginBottom: 0 }}>
                  <span className="field__label">Port</span>
                  <input
                    className="input"
                    type="number"
                    inputMode="numeric"
                    placeholder="9100"
                    value={String(settings.printer?.port ?? 9100)}
                    onChange={(e) =>
                      setSettings((current) => ({
                        ...current,
                        printer: {
                          transport: 'tcp',
                          label: 'WiFi / LAN',
                          host: current.printer?.host ?? '',
                          port: Number(e.target.value) || 9100,
                        },
                      }))
                    }
                  />
                </label>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginTop: 14,
                  }}
                >
                  <div>
                    <p className="field__label" style={{ marginBottom: 2 }}>
                      Printer terpilih
                    </p>
                    <p style={{ margin: 0, fontSize: 13, color: 'var(--app-muted)' }}>
                      {settings.printer ? settings.printer.label : 'Belum dipilih'}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn--outline btn--sm"
                    disabled={!native || listing}
                    onClick={searchDevices}
                  >
                    {listing ? (
                      <IonSpinner name="dots" />
                    ) : (
                      <>
                        <IonIcon icon={searchOutline} /> Cari perangkat
                      </>
                    )}
                  </button>
                </div>

                <div className="list-stack" style={{ marginTop: 12 }}>
                  {devices.map((device) => (
                    <button
                      key={deviceKey(device)}
                      type="button"
                      className="product-row"
                      onClick={() =>
                        setSettings((current) => ({
                          ...current,
                          printer: savedPrinterFromDevice(device),
                        }))
                      }
                    >
                      <span className="thumb" aria-hidden="true">
                        <IonIcon icon={printOutline} />
                      </span>
                      <span className="product-row__main">
                        <span className="product-row__name">{deviceLabel(device)}</span>
                        {device.canPrint === false && (
                          <span className="product-row__sku">Tanpa endpoint cetak</span>
                        )}
                      </span>
                      {selectedKey === deviceKey(device) && (
                        <span className="badge badge--green">Dipilih</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {error && <p className="note note--error">{error}</p>}

          <button
            type="button"
            className="btn btn--plain"
            style={{ marginTop: 16 }}
            disabled={!native || busy || !settings.printer}
            onClick={runTestPrint}
          >
            <IonIcon icon={printOutline} /> Cetak uji
          </button>
        </div>
      </IonContent>
    </IonModal>
  );
};

export default PrinterSettingsModal;
