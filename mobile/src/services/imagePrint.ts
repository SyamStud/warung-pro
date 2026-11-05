import {
  DEFAULT_IMAGE_TONE,
  fitToPaper,
  meanLuminance,
  renderImageEscPos,
  type ImagePrintOptions,
  type ImageToneOptions,
  type RgbaImage,
} from '../lib/receipt';
import type { PaperWidth } from '../lib/receipt';
import { PrinterError, printBytes, type PrinterSettings } from './printer';

/** Decoded, already scaled pixels that are ready to be thresholded. */
export interface LoadedImage {
  raster: RgbaImage;
  /** How the picture will look on paper (width in dots). */
  widthDots: number;
  heightDots: number;
}

/** What the page needs to know before printing: paper footprint and tone. */
export interface ImageInspection {
  widthDots: number;
  heightDots: number;
  /** True for dark-mode screenshots, which print better inverted. */
  dark: boolean;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new PrinterError('invalid_data', 'Gambar tidak bisa dibaca.'));

    image.src = url;
  });
}

/**
 * Draws the picture on a canvas and reads its pixels.
 *
 * The canvas step also flattens transparency: the printer only knows black and
 * white, so transparent areas must become paper-white.
 */
function drawToRaster(image: HTMLImageElement, width: number, height: number): RgbaImage {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new PrinterError('unavailable', 'Canvas tidak tersedia di perangkat ini.');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  const pixels = context.getImageData(0, 0, width, height);

  return { width: pixels.width, height: pixels.height, data: pixels.data };
}

function naturalSize(image: HTMLImageElement): { width: number; height: number } {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;

  if (width <= 0 || height <= 0) {
    throw new PrinterError('invalid_data', 'Ukuran gambar tidak valid.');
  }

  return { width, height };
}

/** Reads the picture and scales it to the paper width, ready to encode. */
export async function loadImageForPrint(url: string, paperWidth: PaperWidth): Promise<LoadedImage> {
  if (typeof document === 'undefined') {
    throw new PrinterError('unavailable', 'Gambar hanya bisa disiapkan di perangkat.');
  }

  const image = await loadImageElement(url);
  const natural = naturalSize(image);
  const size = fitToPaper(natural.width, natural.height, paperWidth);

  return {
    raster: drawToRaster(image, size.width, size.height),
    widthDots: size.width,
    heightDots: size.height,
  };
}

/**
 * Loads a small thumbnail to guess whether the screenshot uses a dark theme.
 * A bright picture stays as-is; a dark one is inverted so the text prints
 * black instead of flooding the paper with ink.
 */
export async function inspectImage(url: string, paperWidth: PaperWidth): Promise<ImageInspection> {
  const image = await loadImageElement(url);
  const natural = naturalSize(image);
  const size = fitToPaper(natural.width, natural.height, paperWidth);

  const thumbnailWidth = Math.max(1, Math.min(96, natural.width));
  const thumbnailHeight = Math.max(1, Math.round((natural.height / natural.width) * thumbnailWidth));
  const dark = meanLuminance(drawToRaster(image, thumbnailWidth, thumbnailHeight)) < 110;

  return { widthDots: size.width, heightDots: size.height, dark };
}

export function imageOptions(
  paperWidth: PaperWidth,
  tone: ImageToneOptions = DEFAULT_IMAGE_TONE,
): ImagePrintOptions {
  return {
    paperWidth,
    threshold: tone.threshold,
    dither: tone.dither,
    invert: tone.invert,
  };
}

/** Encodes the picture for the configured paper width. */
export function encodeImage(image: LoadedImage, options: ImagePrintOptions): Uint8Array {
  return renderImageEscPos(image.raster, options);
}

/** Loads, encodes and sends a picture to the configured thermal printer. */
export async function printImage(
  url: string,
  settings: PrinterSettings,
  tone: ImageToneOptions = DEFAULT_IMAGE_TONE,
): Promise<void> {
  const image = await loadImageForPrint(url, settings.paperWidth);
  await printBytes(encodeImage(image, imageOptions(settings.paperWidth, tone)), settings);
}
