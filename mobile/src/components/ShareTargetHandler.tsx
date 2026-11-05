import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import type { PluginListenerHandle } from '@capacitor/core';
import { useShareInbox } from '../share/useShareInbox';
import { loadPrinterSettings } from '../services/printer';
import {
  getPendingSharedImages,
  isShareTargetSupported,
  listenForSharedImages,
  sharedImageUrl,
  type SharedImage,
} from '../services/shareTarget';

const PRINT_IMAGE_PATH = '/tabs/print';
export const TRANSFER_RECEIPT_PATH = '/tabs/transfer';

/**
 * Bridges the Android share sheet into the visible app.
 *
 * A share normally prints silently from the hidden SharePrintActivity. This
 * handler only sees pictures when that silent path handed them over (no printer
 * configured yet, print failed, ...), so they land on the print page for setup
 * and a retry.
 */
const ShareTargetHandler: React.FC = () => {
  const navigate = useNavigate();
  const { replacePhotos, acknowledgeAutoPrint } = useShareInbox();

  useEffect(() => {
    if (!isShareTargetSupported()) return;

    let cancelled = false;
    let listener: PluginListenerHandle | null = null;
    let resume: PluginListenerHandle | null = null;
    let received: string[] = [];

    const receive = (images: SharedImage[]) => {
      if (images.length === 0) return;

      // The resume listener and the initial read can both see the same queue;
      // only react once per batch.
      const signature = images.map((image) => image.path).join('|');

      if (received.includes(signature)) return;

      received = [signature];

      replacePhotos(
        images.map((image) => ({
          url: sharedImageUrl(image),
          path: image.path,
          name: image.name,
        })),
        { autoPrint: true },
      );

      void (async () => {
        const settings = await loadPrinterSettings();

        if (cancelled) return;

        if (settings.shareMode === 'transfer') {
          // A text receipt always gets a short review before ink hits paper.
          acknowledgeAutoPrint();
          navigate(TRANSFER_RECEIPT_PATH);
          return;
        }

        navigate(PRINT_IMAGE_PATH);
      })();
    };

    void (async () => {
      const registered = await listenForSharedImages(receive);

      // The effect was re-run (React strict mode) before the native side
      // answered: drop this listener and let the next run collect the queue.
      if (cancelled) {
        void registered?.remove();
        return;
      }

      listener = registered;

      // A share that launched the app arrived before the listener existed.
      receive(await getPendingSharedImages());
    })();

    // The hidden print activity may hand over while this screen is already in
    // memory: the app is only resumed, no fresh mount happens.
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void getPendingSharedImages().then(receive);
    }).then((handle) => {
      if (cancelled) {
        void handle.remove();
        return;
      }

      resume = handle;
    });

    return () => {
      cancelled = true;
      void listener?.remove();
      void resume?.remove();
    };
  }, [navigate, replacePhotos, acknowledgeAutoPrint]);

  return null;
};

export default ShareTargetHandler;
