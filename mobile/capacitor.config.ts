import type { CapacitorConfig } from '@capacitor/cli';

// Halaman aplikasi dimuat dari https://localhost di WebView. Kalau API-nya diakses
// lewat HTTP polos (server Laravel di jaringan lokal), request itu dihitung sebagai
// mixed content dan diblokir. Set CAP_ALLOW_HTTP=1 saat `cap sync` (npm run sync:lan)
// untuk mengizinkannya pada build debugging; build produksi tetap menolak mentah-mentah.
const allowHttpApi = process.env.CAP_ALLOW_HTTP === '1';

const config: CapacitorConfig = {
  appId: 'com.warung.pos',
  appName: 'Warung POS',
  webDir: 'dist',
  android: {
    // Hard-refuse cleartext traffic; all API calls go over HTTPS.
    allowMixedContent: allowHttpApi,
  },
  plugins: {
    // Placeholder for BarcodeScanner / Bluetooth printer plugin config (Phase 3 / 6).
  },
};

export default config;
