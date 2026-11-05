import { createContext } from 'react';

/** A picture queued on the "Cetak Gambar" page. */
export interface SharedPhoto {
  /** Local URL the `<img>` and the canvas can read. */
  url: string;
  /** Absolute file path, when the picture came from the Android share sheet. */
  path?: string;
  name?: string;
  /** Object URLs created from the file picker must be released by us. */
  revocable?: boolean;
}

export interface ShareInboxValue {
  photos: SharedPhoto[];
  /** True when the pictures came from the Android share sheet. */
  autoPrint: boolean;
  /** Puts pictures in the inbox, replacing whatever was there. */
  replacePhotos: (photos: SharedPhoto[], options?: { autoPrint?: boolean }) => void;
  /** Appends pictures picked manually on the page. */
  addPhotos: (photos: SharedPhoto[]) => void;
  removePhoto: (index: number) => void;
  clearPhotos: () => void;
  acknowledgeAutoPrint: () => void;
}

export const ShareInboxContext = createContext<ShareInboxValue | null>(null);
