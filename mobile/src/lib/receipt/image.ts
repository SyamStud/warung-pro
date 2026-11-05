import type { PaperWidth } from './types';

/**
 * Printable dots per paper width at 203 dpi — the resolution of every common
 * 58mm/80mm thermal head. 58mm heads are 384 dots (48mm printable), 80mm heads
 * are 576 dots (72mm printable).
 */
export const PAPER_DOTS: Record<PaperWidth, number> = {
  '58': 384,
  '80': 576,
};

/** An image already decoded into RGBA pixels (canvas `ImageData` shape). */
export interface RgbaImage {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export interface ImageToneOptions {
  /** Pixels darker than this become black dots; everything else stays white. */
  threshold: number;
  /** Floyd–Steinberg dithering. Better for photos, worse for crisp text. */
  dither: boolean;
  /** Flips light and dark — for screenshots taken in dark mode. */
  invert: boolean;
}

export interface ImagePrintOptions extends ImageToneOptions {
  paperWidth: PaperWidth;
}

export const DEFAULT_IMAGE_TONE: ImageToneOptions = {
  threshold: 160,
  dither: false,
  invert: false,
};

const ESC = 0x1b;
const GS = 0x1d;

/**
 * Shrinks an image so it fits the printable width. Never enlarges: blowing up
 * a small picture only makes it blurrier, and the printer cannot add detail.
 */
export function fitToPaper(
  width: number,
  height: number,
  paperWidth: PaperWidth,
): { width: number; height: number } {
  const maxDots = PAPER_DOTS[paperWidth];

  if (width <= maxDots || width <= 0 || height <= 0) {
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }

  const scale = maxDots / width;

  return { width: maxDots, height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Flattens RGBA pixels to luminance (0 = black, 255 = white) with transparent
 * areas treated as paper white.
 */
export function toGrayscale(image: RgbaImage): Float32Array {
  const { width, height, data } = image;
  const pixels = width * height;
  const gray = new Float32Array(pixels);

  for (let index = 0; index < pixels; index += 1) {
    const offset = index * 4;
    const alpha = data[offset + 3] ?? 255;
    const luminance =
      0.299 * (data[offset] ?? 255) +
      0.587 * (data[offset + 1] ?? 255) +
      0.114 * (data[offset + 2] ?? 255);

    gray[index] = (luminance * alpha + 255 * (255 - alpha)) / 255;
  }

  return gray;
}

/** Average brightness of a picture; a low value means a dark-mode screenshot. */
export function meanLuminance(image: RgbaImage): number {
  const gray = toGrayscale(image);

  if (gray.length === 0) return 255;

  let total = 0;

  for (let index = 0; index < gray.length; index += 1) {
    total += gray[index];
  }

  return total / gray.length;
}

/**
 * Turns RGBA pixels into one bit per dot (`1` = black).
 */
export function toMonochrome(image: RgbaImage, options: ImageToneOptions): Uint8Array {
  const { width, height } = image;
  const pixels = width * height;
  const gray = toGrayscale(image);

  if (options.invert) {
    for (let index = 0; index < pixels; index += 1) {
      gray[index] = 255 - gray[index];
    }
  }

  const threshold = Math.min(255, Math.max(1, options.threshold));
  const dots = new Uint8Array(pixels);

  if (!options.dither) {
    for (let index = 0; index < pixels; index += 1) {
      dots[index] = gray[index] < threshold ? 1 : 0;
    }

    return dots;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const oldValue = gray[index];
      const newValue = oldValue < threshold ? 0 : 255;

      dots[index] = newValue === 0 ? 1 : 0;

      const error = oldValue - newValue;

      if (x + 1 < width) {
        gray[index + 1] += (error * 7) / 16;
      }
      if (y + 1 < height) {
        if (x > 0) {
          gray[index + width - 1] += (error * 3) / 16;
        }
        gray[index + width] += (error * 5) / 16;
        if (x + 1 < width) {
          gray[index + width + 1] += error / 16;
        }
      }
    }
  }

  return dots;
}

/** Packs one-bit dots into rows padded to whole bytes, MSB first. */
export function packRaster(
  dots: Uint8Array,
  width: number,
  height: number,
): { bytesPerRow: number; data: Uint8Array } {
  const bytesPerRow = Math.ceil(width / 8);
  const data = new Uint8Array(bytesPerRow * height);

  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * bytesPerRow;

    for (let x = 0; x < width; x += 1) {
      if (dots[y * width + x] === 1) {
        data[rowOffset + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }

  return { bytesPerRow, data };
}

/**
 * Encodes a picture as an ESC/POS raster (`GS v 0`) with the same prologue and
 * trailer as receipts: initialise, left-align, feed three lines, partial cut.
 */
export function renderImageEscPos(image: RgbaImage, options: ImagePrintOptions): Uint8Array {
  const dots = toMonochrome(image, options);
  const { bytesPerRow, data } = packRaster(dots, image.width, image.height);

  const prologue = [
    ESC, 0x40, // initialise
    ESC, 0x74, 0x00, // code page PC437
    ESC, 0x61, 0x00, // left align
  ];

  const rasterHeader = [
    GS, 0x76, 0x30, 0x00, // GS v 0, mode 0
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    image.height & 0xff,
    (image.height >> 8) & 0xff,
  ];

  const epilogue = [
    ESC, 0x64, 0x03, // feed 3 lines
    GS, 0x56, 0x42, 0x00, // partial cut
  ];

  const bytes = new Uint8Array(
    prologue.length + rasterHeader.length + data.length + epilogue.length,
  );
  let offset = 0;

  bytes.set(prologue, offset);
  offset += prologue.length;
  bytes.set(rasterHeader, offset);
  offset += rasterHeader.length;
  bytes.set(data, offset);
  offset += data.length;
  bytes.set(epilogue, offset);

  return bytes;
}
