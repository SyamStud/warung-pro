import { Preferences } from '@capacitor/preferences';
import { DEFAULT_IMAGE_TONE } from '../lib/receipt';

/** What the print-image page remembers between shares. */
export interface ImageTonePreferences {
  /** Pixels darker than this become black dots. */
  threshold: number;
  /** Floyd–Steinberg dithering. */
  dither: boolean;
}

export const DEFAULT_TONE_PREFERENCES: ImageTonePreferences = {
  threshold: DEFAULT_IMAGE_TONE.threshold,
  dither: DEFAULT_IMAGE_TONE.dither,
};

const SETTINGS_KEY = 'image.print.tone.v1';
const MIN_THRESHOLD = 40;
const MAX_THRESHOLD = 230;

function clampThreshold(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return DEFAULT_TONE_PREFERENCES.threshold;

  return Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, Math.round(parsed)));
}

export async function loadImageTone(): Promise<ImageTonePreferences> {
  try {
    const { value } = await Preferences.get({ key: SETTINGS_KEY });

    if (!value) return DEFAULT_TONE_PREFERENCES;

    const parsed = JSON.parse(value) as Partial<ImageTonePreferences>;

    return {
      threshold: clampThreshold(parsed.threshold),
      dither: Boolean(parsed.dither),
    };
  } catch {
    return DEFAULT_TONE_PREFERENCES;
  }
}

export async function saveImageTone(tone: ImageTonePreferences): Promise<void> {
  await Preferences.set({
    key: SETTINGS_KEY,
    value: JSON.stringify({
      threshold: clampThreshold(tone.threshold),
      dither: tone.dither,
    }),
  });
}
