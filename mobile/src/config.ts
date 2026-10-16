/**
 * Runtime configuration.
 *
 * The API base URL is injected at build time via `VITE_API_BASE_URL`.
 * Never hardcode backend secrets here — this bundle ships inside the APK.
 */
export const config = {
  apiBaseUrl:
    import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') ??
    'http://localhost:8000/api/v1',
  /** Default page size for paginated catalog / history endpoints. */
  pageSize: 20,
} as const;
