import { expect, test } from 'vitest';
import { confirmCandidate, decodeCanvas, frameToVideoRoi } from './scanFrame';

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
});

test('confirmCandidate: butuh dua bacaan berturut-turut dalam jendela waktu', () => {
  const first = confirmCandidate(null, '8991234567890', 1000);
  expect(first.confirmed).toBe(false);
  expect(first.candidate.count).toBe(1);

  const second = confirmCandidate(first.candidate, '8991234567890', 1100);
  expect(second.confirmed).toBe(true);
  expect(second.candidate.count).toBe(2);
});

test('confirmCandidate: nilai yang berselang-seling mereset hitungan', () => {
  const first = confirmCandidate(null, '111', 1000);
  const second = confirmCandidate(first.candidate, '222', 1100);
  const third = confirmCandidate(second.candidate, '111', 1200);

  expect(third.confirmed).toBe(false);
  expect(third.candidate.count).toBe(1);
});

test('confirmCandidate: bacaan yang jaraknya terlalu jauh tidak dihitung', () => {
  const first = confirmCandidate(null, '111', 1000);

  // Jendela 1200ms: bacaan pada 2300ms terlalu telat, hitungan mulai dari satu.
  const second = confirmCandidate(first.candidate, '111', 2300);

  expect(second.confirmed).toBe(false);
  expect(second.candidate.count).toBe(1);
});

test('decodeCanvas: nilai dipangkas, kosong jadi null, NotFound tidak melempar', () => {
  const zxing = {
    BinaryBitmap: class {},
    HybridBinarizer: class {},
    HTMLCanvasElementLuminanceSource: class {},
  } as unknown as Parameters<typeof decodeCanvas>[0];
  const canvas = document.createElement('canvas');

  const read = (text: string) => ({ decodeWithState: () => ({ getText: () => text }) });

  expect(decodeCanvas(zxing, read(' 8991 '), canvas)).toBe('8991');
  expect(decodeCanvas(zxing, read('   '), canvas)).toBe(null);
  expect(
    decodeCanvas(
      zxing,
      {
        decodeWithState: () => {
          throw new Error('NotFoundException');
        },
      },
      canvas,
    ),
  ).toBe(null);
});

test('frameToVideoRoi: bingkai di tengah video dengan rasio sama', () => {
  const roi = frameToVideoRoi(
    { videoWidth: 1280, videoHeight: 720, rect: rect(0, 0, 1280, 720) },
    rect(440, 260, 400, 400),
  );

  // Bingkai 400px + margin 18% → 472px di sekitar titik tengah bingkai (640,460).
  expect(roi?.sSize).toBe(472);
  expect(roi?.sx).toBe(640 - 236);
  expect(roi?.sy).toBe(460 - 236);
  expect(roi?.size).toBe(472);
});

test('frameToVideoRoi: memperhitungkan cropping "object-fit: cover"', () => {
  // Video 16:9 di kotak 400x400: video melebar 711px, sisi kiri/kanan terpotong.
  const roi = frameToVideoRoi(
    { videoWidth: 1280, videoHeight: 720, rect: rect(0, 0, 400, 400) },
    rect(150, 150, 100, 100),
  );

  // Bingkai tepat di tengah layar harus memetakan ke pusat video (640, 360).
  expect(roi?.sSize).toBe(212);
  expect(roi?.sx).toBe(640 - 106);
  expect(roi?.sy).toBe(360 - 106);
  // Terlalu kecil untuk didekode akurat → dinaikkan ke ukuran minimum.
  expect(roi?.size).toBe(320);
});

test('frameToVideoRoi: menolak saat video atau kotaknya belum siap', () => {
  expect(
    frameToVideoRoi({ videoWidth: 0, videoHeight: 0, rect: rect(0, 0, 400, 300) }, rect(1, 1, 10, 10)),
  ).toBe(null);
  expect(
    frameToVideoRoi({ videoWidth: 1280, videoHeight: 720, rect: rect(0, 0, 0, 0) }, rect(1, 1, 10, 10)),
  ).toBe(null);
});

test('frameToVideoRoi: bingkai di tepi tetap berada di dalam video', () => {
  // Bingkai di pojok kiri atas layar; ROI tidak boleh keluar dari frame video.
  const roi = frameToVideoRoi(
    { videoWidth: 1280, videoHeight: 720, rect: rect(0, 0, 400, 300) },
    rect(0, 0, 100, 100),
  );

  expect(roi).not.toBe(null);
  expect(roi?.sx).toBeGreaterThanOrEqual(0);
  expect(roi?.sy).toBeGreaterThanOrEqual(0);
  expect((roi?.sx ?? 0) + (roi?.sSize ?? 0)).toBeLessThanOrEqual(1280);
  expect((roi?.sy ?? 0) + (roi?.sSize ?? 0)).toBeLessThanOrEqual(720);
});
