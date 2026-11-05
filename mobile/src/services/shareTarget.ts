import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

/** One image handed over by the Android share sheet. */
export interface SharedImage {
  /** Absolute path inside the app cache directory. */
  path: string;
  mimeType: string;
  name?: string;
}

interface ShareTargetPlugin {
  /** Images that arrived before the WebView was listening (cold start). */
  getPending(): Promise<{ images: SharedImage[] }>;
  /** Same list, but nothing is removed — used by the silent print flow. */
  peek(): Promise<{ images: SharedImage[] }>;
  /** Drops the queue once the silent flow has printed everything. */
  acknowledge(options?: { paths?: string[] }): Promise<void>;
  /** True when this WebView is the hidden SharePrintActivity. */
  isHeadless(): Promise<{ headless: boolean }>;
  /** Closes the hidden activity, optionally with a short confirmation toast. */
  closeHeadless(options?: { message?: string }): Promise<void>;
  /** Falls back to the visible app (printer missing, print failed, ...). */
  openApp(): Promise<void>;
  addListener(
    eventName: 'shared',
    listener: (event: { images: SharedImage[] }) => void,
  ): Promise<PluginListenerHandle>;
}

const ShareTarget = registerPlugin<ShareTargetPlugin>('ShareTarget');

/** Sharing into the app is an Android-only entry point. */
export function isShareTargetSupported(): boolean {
  return Capacitor.getPlatform() === 'android';
}

/** The `file://` path cannot be loaded by the WebView directly. */
export function sharedImageUrl(image: SharedImage): string {
  return Capacitor.convertFileSrc(image.path);
}

function isUsable(image: SharedImage): boolean {
  return Boolean(image?.path) && (image.mimeType ?? '').startsWith('image/');
}

function usable(images: SharedImage[] | undefined): SharedImage[] {
  return (images ?? []).filter(isUsable);
}

export async function getPendingSharedImages(): Promise<SharedImage[]> {
  if (!isShareTargetSupported()) return [];

  try {
    const { images } = await ShareTarget.getPending();
    return usable(images);
  } catch {
    return [];
  }
}

/** Reads the share queue without consuming it. */
export async function peekSharedImages(): Promise<SharedImage[]> {
  if (!isShareTargetSupported()) return [];

  try {
    const { images } = await ShareTarget.peek();
    return usable(images);
  } catch {
    return [];
  }
}

export async function acknowledgeSharedImages(paths?: string[]): Promise<void> {
  if (!isShareTargetSupported()) return;

  try {
    await ShareTarget.acknowledge(paths && paths.length > 0 ? { paths } : undefined);
  } catch {
    /* nothing to do — the pictures stay queued and the next share retries */
  }
}

/**
 * Whether the current WebView is the invisible share-print activity. The app
 * uses this before the auth gate so a share never flashes a login screen.
 */
export async function isHeadlessLaunch(): Promise<boolean> {
  if (!isShareTargetSupported()) return false;

  try {
    const { headless } = await ShareTarget.isHeadless();
    return Boolean(headless);
  } catch {
    return false;
  }
}

export async function closeHeadless(message?: string): Promise<void> {
  if (!isShareTargetSupported()) return;

  try {
    await ShareTarget.closeHeadless(message ? { message } : undefined);
  } catch {
    /* the activity watchdog closes it anyway */
  }
}

/** Brings the normal app forward, keeping the queue for the print page. */
export async function openAppForSetup(): Promise<void> {
  if (!isShareTargetSupported()) return;

  try {
    await ShareTarget.openApp();
  } catch {
    /* the activity watchdog closes it anyway */
  }
}

/**
 * Subscribes to shares that arrive while the app is already open. Returns null
 * on platforms without the native plugin.
 *
 * The event is only a signal: the pictures are read back through `getPending`
 * so there is a single queue on the native side and nothing is printed twice.
 */
export async function listenForSharedImages(
  onImages: (images: SharedImage[]) => void,
): Promise<PluginListenerHandle | null> {
  if (!isShareTargetSupported()) return null;

  try {
    return await ShareTarget.addListener('shared', () => {
      void getPendingSharedImages().then(onImages);
    });
  } catch {
    return null;
  }
}
