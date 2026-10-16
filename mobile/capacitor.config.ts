import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.warung.pos',
  appName: 'Warung POS',
  webDir: 'dist',
  android: {
    // Hard-refuse cleartext traffic; all API calls go over HTTPS.
    allowMixedContent: false,
  },
  plugins: {
    // Placeholder for BarcodeScanner / Bluetooth printer plugin config (Phase 3 / 6).
  },
};

export default config;
