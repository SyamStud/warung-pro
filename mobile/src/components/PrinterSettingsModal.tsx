import { useEffect, useState } from 'react';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonModal,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  useIonToast,
} from '@ionic/react';
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
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onDismiss}>Tutup</IonButton>
          </IonButtons>
          <IonTitle>Pengaturan Printer</IonTitle>
          <IonButtons slot="end">
            <IonButton strong disabled={busy} onClick={save}>
              {busy ? <IonSpinner name="dots" /> : 'Simpan'}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {!native && (
          <IonNote color="warning" className="ion-display-block ion-padding-bottom">
            Pencetakan hanya tersedia di aplikasi Android. Di browser, struk akan ditampilkan
            sebagai pratinjau.
          </IonNote>
        )}

        <IonList>
          <IonListHeader>
            <IonLabel>Struk</IonLabel>
          </IonListHeader>

          <IonItem>
            <IonSelect
              label="Lebar kertas"
              labelPlacement="stacked"
              value={settings.paperWidth}
              onIonChange={(e) =>
                setSettings((current) => ({ ...current, paperWidth: e.detail.value }))
              }
            >
              {PAPER_WIDTHS.map((width) => (
                <IonSelectOption key={width} value={width}>
                  {PAPER_LABELS[width]}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonInput
              label="Nama toko"
              labelPlacement="stacked"
              value={settings.storeName}
              onIonInput={(e) =>
                setSettings((current) => ({ ...current, storeName: e.detail.value ?? '' }))
              }
            />
          </IonItem>

          <IonItem>
            <IonInput
              label="Alamat (opsional)"
              labelPlacement="stacked"
              value={settings.storeAddress}
              onIonInput={(e) =>
                setSettings((current) => ({ ...current, storeAddress: e.detail.value ?? '' }))
              }
            />
          </IonItem>

          <IonItem>
            <IonTextarea
              label="Footer (opsional)"
              labelPlacement="stacked"
              autoGrow
              value={settings.footer}
              onIonInput={(e) =>
                setSettings((current) => ({ ...current, footer: e.detail.value ?? '' }))
              }
            />
          </IonItem>
        </IonList>

        <IonList>
          <IonListHeader>
            <IonLabel>Koneksi printer</IonLabel>
          </IonListHeader>

          <IonItem>
            <IonSelect
              label="Jenis koneksi"
              labelPlacement="stacked"
              value={transport}
              onIonChange={(e) => chooseTransport(e.detail.value)}
            >
              {(['bluetooth', 'usb', 'tcp'] as PrinterTransportKind[]).map((kind) => (
                <IonSelectOption key={kind} value={kind}>
                  {TRANSPORT_LABELS[kind]}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          {transport === 'tcp' && (
            <>
              <IonItem>
                <IonInput
                  label="Alamat IP / host"
                  labelPlacement="stacked"
                  placeholder="192.168.1.50"
                  value={settings.printer?.host ?? ''}
                  onIonInput={(e) =>
                    setSettings((current) => ({
                      ...current,
                      printer: {
                        transport: 'tcp',
                        label: 'WiFi / LAN',
                        host: e.detail.value ?? '',
                        port: current.printer?.port ?? 9100,
                      },
                    }))
                  }
                />
              </IonItem>
              <IonItem>
                <IonInput
                  type="number"
                  inputmode="numeric"
                  label="Port"
                  labelPlacement="stacked"
                  placeholder="9100"
                  value={String(settings.printer?.port ?? 9100)}
                  onIonInput={(e) =>
                    setSettings((current) => ({
                      ...current,
                      printer: {
                        transport: 'tcp',
                        label: 'WiFi / LAN',
                        host: current.printer?.host ?? '',
                        port: Number(e.detail.value) || 9100,
                      },
                    }))
                  }
                />
              </IonItem>
            </>
          )}

          {transport !== 'tcp' && (
            <>
              <IonItem>
                <IonLabel>
                  <h3>Printer terpilih</h3>
                  <p>{settings.printer ? settings.printer.label : 'Belum dipilih'}</p>
                </IonLabel>
                <IonButton
                  slot="end"
                  fill="outline"
                  disabled={!native || listing}
                  onClick={searchDevices}
                >
                  {listing ? <IonSpinner name="dots" /> : 'Cari perangkat'}
                </IonButton>
              </IonItem>

              {devices.map((device) => (
                <IonItem
                  key={deviceKey(device)}
                  button
                  onClick={() =>
                    setSettings((current) => ({ ...current, printer: savedPrinterFromDevice(device) }))
                  }
                >
                  <IonLabel>
                    <h2>{deviceLabel(device)}</h2>
                    {device.canPrint === false && <p>Tanpa endpoint cetak</p>}
                  </IonLabel>
                  {selectedKey === deviceKey(device) && <IonNote slot="end">Dipilih</IonNote>}
                </IonItem>
              ))}
            </>
          )}
        </IonList>

        {error && (
          <IonNote color="danger" className="ion-display-block ion-padding-vertical">
            {error}
          </IonNote>
        )}

        <IonButton
          expand="block"
          fill="outline"
          className="ion-margin-top"
          disabled={!native || busy || !settings.printer}
          onClick={runTestPrint}
        >
          Cetak uji
        </IonButton>
      </IonContent>
    </IonModal>
  );
};

export default PrinterSettingsModal;
