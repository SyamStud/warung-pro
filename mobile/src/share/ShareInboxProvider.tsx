import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { ShareInboxContext, type SharedPhoto, type ShareInboxValue } from './context';

function release(photos: SharedPhoto[]): void {
  for (const photo of photos) {
    if (photo.revocable) {
      URL.revokeObjectURL(photo.url);
    }
  }
}

/**
 * Holds pictures shared from other apps (or picked on the page) until the user
 * prints them. Lives above the router so a share that arrives while the app is
 * on another screen survives the navigation to the print page.
 */
export const ShareInboxProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [photos, setPhotoList] = useState<SharedPhoto[]>([]);
  const [autoPrint, setAutoPrint] = useState(false);
  const photosRef = useRef<SharedPhoto[]>([]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const replacePhotos = useCallback<ShareInboxValue['replacePhotos']>((next, options) => {
    const clean = next.filter((photo) => Boolean(photo.url));

    if (clean.length === 0) return;

    release(photosRef.current);
    setPhotoList(clean);
    setAutoPrint(Boolean(options?.autoPrint));
  }, []);

  const addPhotos = useCallback<ShareInboxValue['addPhotos']>((next) => {
    const clean = next.filter((photo) => Boolean(photo.url));

    if (clean.length === 0) return;

    setPhotoList((current) => [...current, ...clean]);
  }, []);

  const removePhoto = useCallback((index: number) => {
    const removed = photosRef.current[index];

    if (!removed) return;

    release([removed]);
    setPhotoList((current) => current.filter((_, position) => position !== index));
  }, []);

  const clearPhotos = useCallback(() => {
    release(photosRef.current);
    setPhotoList([]);
    setAutoPrint(false);
  }, []);

  const acknowledgeAutoPrint = useCallback(() => setAutoPrint(false), []);

  // Anything still queued when the provider goes away must not leak its blob.
  useEffect(() => {
    return () => release(photosRef.current);
  }, []);

  const value = useMemo(
    () => ({
      photos,
      autoPrint,
      replacePhotos,
      addPhotos,
      removePhoto,
      clearPhotos,
      acknowledgeAutoPrint,
    }),
    [photos, autoPrint, replacePhotos, addPhotos, removePhoto, clearPhotos, acknowledgeAutoPrint],
  );

  return <ShareInboxContext.Provider value={value}>{children}</ShareInboxContext.Provider>;
};

export default ShareInboxProvider;
