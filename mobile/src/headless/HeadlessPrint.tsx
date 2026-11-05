import { useEffect } from 'react';
import { parseTransferReceipt } from '../lib/transfer/parse';
import { isTransferReceiptUsable } from '../lib/transfer/types';
import { inspectImage, printImage } from '../services/imagePrint';
import { loadImageTone } from '../services/imageSettings';
import { recognizeImageText } from '../services/ocr';
import { loadPrinterSettings, printTransferReceipt } from '../services/printer';
import {
  acknowledgeSharedImages,
  closeHeadless,
  openAppForSetup,
  peekSharedImages,
  sharedImageUrl,
} from '../services/shareTarget';

/** A second share can land while the first is printing; drain a few batches. */
const MAX_ROUNDS = 5;

/**
 * Runs inside the invisible SharePrintActivity: takes the pictures the share
 * sheet handed over, prints them with the saved printer and tone settings, and
 * closes without ever painting a screen.
 *
 * Anything that needs the user (no printer yet, permission denied, connection
 * failure) hands over to the normal app with the pictures still queued, so the
 * print page can explain what to fix.
 */
const HeadlessPrint: React.FC = () => {
  useEffect(() => {
    void run();

    async function run() {
      const firstBatch = await peekSharedImages();

      if (firstBatch.length === 0) {
        await closeHeadless();
        return;
      }

      const [settings, tone] = await Promise.all([loadPrinterSettings(), loadImageTone()]);

      if (!settings.printer) {
        await openAppForSetup();
        return;
      }

      let printed = 0;

      for (let round = 0; round < MAX_ROUNDS; round += 1) {
        const images = round === 0 ? firstBatch : await peekSharedImages();

        if (images.length === 0) break;

        try {
          for (const image of images) {
            if (settings.shareMode === 'transfer') {
              // Bank proof: read the fields and print a text receipt. If the
              // amount or reference cannot be read confidently, hand over to
              // the visible editor instead of printing a wrong number.
              const text = await recognizeImageText(image.path);
              const data = parseTransferReceipt(text);

              if (!isTransferReceiptUsable(data)) {
                await openAppForSetup();
                return;
              }

              await printTransferReceipt(data, settings);
              await acknowledgeSharedImages([image.path]);
              printed += 1;
              continue;
            }

            const url = sharedImageUrl(image);
            // Dark-mode screenshots need the inversion the page normally applies.
            const inspection = await inspectImage(url, settings.paperWidth);

            await printImage(url, settings, { ...tone, invert: inspection.dark });

            // Drop this picture only; anything shared meanwhile must survive.
            await acknowledgeSharedImages([image.path]);
            printed += 1;
          }
        } catch {
          await openAppForSetup();
          return;
        }
      }

      await closeHeadless(printed > 0 ? 'Gambar dikirim ke printer.' : undefined);
    }
  }, []);

  // The window hosting this component is transparent; nothing is rendered.
  return null;
};

export default HeadlessPrint;
