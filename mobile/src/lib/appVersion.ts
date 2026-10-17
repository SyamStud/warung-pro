import { App } from '@capacitor/app';

/**
 * The installed Android `versionCode`, which is what decides whether the
 * server has something newer to offer.
 *
 * `VITE_APP_BUILD_CODE` stands in for it where the App plugin is unavailable
 * (a browser during development and the browser tests). With neither number the
 * update check is skipped instead of guessing a version.
 */
export async function installedBuild(): Promise<number | null> {
  try {
    const info = await App.getInfo();
    const build = Number(info.build);

    if (Number.isFinite(build) && build > 0) return build;
  } catch {
    /* Not a native platform — fall through to the build-time hint. */
  }

  const fallback = Number(import.meta.env.VITE_APP_BUILD_CODE);

  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
}
