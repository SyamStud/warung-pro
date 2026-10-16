import { useState } from 'react';
import { useIonAlert, useIonToast } from '@ionic/react';
import {
  PrinterError,
  isPrintingSupported,
  loadPrinterSettings,
  previewReceipt,
  printTransaction,
} from '../services/printer';
import type { Transaction } from '../types';

export interface ReceiptPreview {
  title: string;
  text: string;
}

/**
 * Shared receipt-printing flow: prints on Android, previews on web, and routes
 * the user to printer settings when none is configured yet.
 */
export function useReceiptPrinter() {
  const [presentAlert] = useIonAlert();
  const [presentToast] = useIonToast();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState<ReceiptPreview | null>(null);

  const print = async (transaction: Transaction) => {
    const settings = await loadPrinterSettings();

    if (!isPrintingSupported()) {
      setPreview({
        title: transaction.transaction_number,
        text: previewReceipt(transaction, settings),
      });
      return;
    }

    if (!settings.printer) {
      presentToast({
        message: 'Pilih printer dulu di pengaturan.',
        duration: 2000,
        color: 'warning',
        position: 'top',
      });
      setSettingsOpen(true);
      return;
    }

    try {
      await printTransaction(transaction, settings);
      presentToast({
        message: 'Struk dikirim ke printer.',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
    } catch (caught) {
      presentAlert({
        header: 'Cetak gagal',
        message: caught instanceof PrinterError ? caught.message : 'Gagal mencetak struk.',
        buttons: [{ text: 'Pengaturan', handler: () => setSettingsOpen(true) }, 'Tutup'],
      });
    }
  };

  return {
    print,
    settingsOpen,
    openSettings: () => setSettingsOpen(true),
    closeSettings: () => setSettingsOpen(false),
    preview,
    closePreview: () => setPreview(null),
  };
}
