/**
 * Frame-level scanning logic for Cek Harga, kept apart from the component so it
 * can be reasoned about (and tested) on its own: which part of the video to
 * look at, how to decode it, and when a reading is trustworthy enough to act
 * on. Nothing here touches React or the DOM beyond the plain rectangle values
 * it is handed.
 */
type Zxing = typeof import('@zxing/library');
type ZxingReader = InstanceType<Zxing['MultiFormatReader']>;

export interface FrameReader {
  decodeWithState: (bitmap: Parameters<ZxingReader['decodeWithState']>[0]) => {
    getText: () => string;
  };
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface Roi {
  /** Source rectangle inside the video, in video pixels. */
  sx: number;
  sy: number;
  sSize: number;
  /** Square size handed to the decoder (the source is rescaled to it). */
  size: number;
}

export interface Candidate {
  value: string;
  count: number;
  lastAt: number;
}

/** The same value must be decoded this many times in a row before we trust it. */
export const CONFIRMATIONS = 2;
/** …and within this window, otherwise the count starts over. */
export const CONFIRM_WINDOW_MS = 1200;

/**
 * Decides whether a just-decoded value is trustworthy: the same value must be
 * seen `CONFIRMATIONS` times in a row inside `CONFIRM_WINDOW_MS`, so one noisy
 * frame can never report a wrong code. An interleaved different value restarts
 * the count.
 */
export function confirmCandidate(
  previous: Candidate | null,
  value: string,
  now: number,
): { confirmed: boolean; candidate: Candidate } {
  const consecutive =
    previous !== null && previous.value === value && now - previous.lastAt <= CONFIRM_WINDOW_MS;

  const candidate: Candidate = consecutive
    ? { value, count: (previous as Candidate).count + 1, lastAt: now }
    : { value, count: 1, lastAt: now };

  return { confirmed: candidate.count >= CONFIRMATIONS, candidate };
}

/**
 * Decodes one already-cropped canvas; null when this frame holds no readable
 * code.
 *
 * `HTMLCanvasElementLuminanceSource` is the source the browser reader uses
 * itself: it converts the canvas RGBA into luminance (alpha-aware). Handing
 * `RGBLuminanceSource` a `Uint8ClampedArray` would silently treat the raw RGBA
 * bytes as one byte per pixel and never decode anything.
 */
export function decodeCanvas(
  zxing: Zxing,
  reader: FrameReader,
  canvas: HTMLCanvasElement,
): string | null {
  try {
    const bitmap = new zxing.BinaryBitmap(
      new zxing.HybridBinarizer(new zxing.HTMLCanvasElementLuminanceSource(canvas)),
    );
    return reader.decodeWithState(bitmap).getText().trim() || null;
  } catch {
    /* NotFound / Checksum / Format — the ordinary outcome for most frames. */
    return null;
  }
}

/** Padding around the on-screen frame: covers a slightly-off aim. */
export const FRAME_PADDING = 1.18;
export const ROI_MIN = 320;
export const ROI_MAX = 960;

/**
 * Maps the on-screen viewfinder frame back into video pixels.
 *
 * The video is drawn with `object-fit: cover`, so the container crops part of
 * it away; this undoes that mapping. Decoding only this region is what makes
 * the scan both accurate (background clutter is ignored) and quick (a fraction
 * of the pixels).
 */
export function frameToVideoRoi(
  video: { videoWidth: number; videoHeight: number; rect: Rect },
  frame: Rect,
): Roi | null {
  const { videoWidth: vw, videoHeight: vh, rect } = video;
  if (vw <= 0 || vh <= 0 || rect.width <= 0 || rect.height <= 0) return null;

  // Where the video actually lands inside its box when shown with `cover`.
  const videoAspect = vw / vh;
  const rectAspect = rect.width / rect.height;
  const contentW = videoAspect > rectAspect ? rect.height * videoAspect : rect.width;
  const contentH = videoAspect > rectAspect ? rect.height : rect.width / videoAspect;
  const offsetX = rect.left + (rect.width - contentW) / 2;
  const offsetY = rect.top + (rect.height - contentH) / 2;
  const cssPerVideo = contentW / vw;

  const videoSide = Math.max(frame.width, frame.height) * FRAME_PADDING;
  const side = Math.min(Math.round(videoSide / cssPerVideo), Math.min(vw, vh));
  if (side <= 0) return null;

  const centerX = (frame.left + frame.width / 2 - offsetX) / cssPerVideo;
  const centerY = (frame.top + frame.height / 2 - offsetY) / cssPerVideo;

  return {
    sx: Math.max(0, Math.min(Math.round(centerX - side / 2), vw - side)),
    sy: Math.max(0, Math.min(Math.round(centerY - side / 2), vh - side)),
    sSize: side,
    size: Math.min(Math.max(side, ROI_MIN), ROI_MAX),
  };
}
