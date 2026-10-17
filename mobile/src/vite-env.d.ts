/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /**
   * Stands in for the Android `versionCode` where the App plugin is not
   * available (a browser during development and the browser tests). The APK
   * itself always reports its real build.
   */
  readonly VITE_APP_BUILD_CODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
