import { Capacitor } from '@capacitor/core';
import { Script, TextRecognition } from '@capacitor-mlkit/text-recognition';

/**
 * On-device text recognition. The ML Kit model is bundled with the app, so a
 * screenshot never leaves the phone.
 */
export function isTextRecognitionSupported(): boolean {
  return Capacitor.getPlatform() === 'android';
}

export class TextRecognitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TextRecognitionError';
  }
}

/** Reads every line of text visible in the image at `path`. */
export async function recognizeImageText(path: string): Promise<string> {
  if (!path) {
    throw new TextRecognitionError('Gambar tidak punya berkas yang bisa dibaca.');
  }

  if (!isTextRecognitionSupported()) {
    throw new TextRecognitionError(
      'Membaca teks dari gambar hanya tersedia di aplikasi Android.',
    );
  }

  try {
    const { text } = await TextRecognition.processImage({ path, script: Script.Latin });
    return text ?? '';
  } catch {
    throw new TextRecognitionError(
      'Tulisan di gambar tidak bisa dibaca. Coba foto ulang dengan pencahayaan lebih baik, atau isi datanya manual.',
    );
  }
}
