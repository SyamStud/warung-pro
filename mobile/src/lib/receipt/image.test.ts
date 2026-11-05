import { expect, test } from 'vitest';
import {
  PAPER_DOTS,
  fitToPaper,
  meanLuminance,
  packRaster,
  renderImageEscPos,
  toMonochrome,
  type RgbaImage,
} from './image';

/** Builds RGBA pixels from a compact 0/1 map (1 = black, 0 = white). */
function imageFromRows(rows: number[][], alpha = 255): RgbaImage {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const value = rows[y][x] === 1 ? 0 : 255;

      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = alpha;
    }
  }

  return { width, height, data };
}

test('paper widths map to the printable dot count of 58mm and 80mm heads', () => {
  expect(PAPER_DOTS['58']).toBe(384);
  expect(PAPER_DOTS['80']).toBe(576);
});

test('wide screenshots shrink to the paper width and keep their proportions', () => {
  expect(fitToPaper(1080, 2400, '58')).toEqual({ width: 384, height: 853 });
  expect(fitToPaper(1080, 2400, '80')).toEqual({ width: 576, height: 1280 });
});

test('small images are never enlarged', () => {
  expect(fitToPaper(200, 100, '58')).toEqual({ width: 200, height: 100 });
});

test('dark pixels become dots and light pixels stay blank', () => {
  const dots = toMonochrome(imageFromRows([[1, 0, 1]]), { threshold: 160, dither: false, invert: false });

  expect(Array.from(dots)).toEqual([1, 0, 1]);
});

test('fully transparent pixels print as paper white', () => {
  const image: RgbaImage = {
    width: 1,
    height: 1,
    data: new Uint8ClampedArray([0, 0, 0, 0]),
  };

  expect(Array.from(toMonochrome(image, { threshold: 160, dither: false, invert: false }))).toEqual([0]);
});

test('dots are packed MSB first and rows are padded to whole bytes', () => {
  const dots = new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
  const { bytesPerRow, data } = packRaster(dots, 10, 1);

  expect(bytesPerRow).toBe(2);
  expect(Array.from(data)).toEqual([0b1000_0000, 0b1100_0000]);
});

test('the ESC/POS stream carries the raster geometry and a cut', () => {
  const image = imageFromRows([
    [1, 0, 1, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 0, 0, 0, 0],
  ]);
  const bytes = renderImageEscPos(image, { paperWidth: '58', threshold: 160, dither: false, invert: false });

  // ESC @ | GS v 0 0 | xL xH (1 byte/row) | yL yH (2 rows) | data | ESC d 3 | GS V B 0
  expect(Array.from(bytes.slice(0, 8))).toEqual([0x1b, 0x40, 0x1b, 0x74, 0x00, 0x1b, 0x61, 0x00]);
  expect(Array.from(bytes.slice(8, 16))).toEqual([0x1d, 0x76, 0x30, 0x00, 0x01, 0x00, 0x02, 0x00]);
  expect(Array.from(bytes.slice(16, 18))).toEqual([0b1010_0000, 0b0100_0000]);
  expect(Array.from(bytes.slice(-7))).toEqual([0x1b, 0x64, 0x03, 0x1d, 0x56, 0x42, 0x00]);
});

test('inverting swaps dark and light for dark-mode screenshots', () => {
  const dots = toMonochrome(imageFromRows([[1, 0, 1]]), {
    threshold: 160,
    dither: false,
    invert: true,
  });

  expect(Array.from(dots)).toEqual([0, 1, 0]);
});

test('mean luminance separates a dark screenshot from a paper-white one', () => {
  expect(meanLuminance(imageFromRows([[1, 1]]))).toBeCloseTo(0);
  expect(meanLuminance(imageFromRows([[0, 0]]))).toBeCloseTo(255);
});
