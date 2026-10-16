# Rilis Aplikasi Android

Panduan menandatangani (sign) dan membangun APK/AAB release untuk aplikasi Ionic +
Capacitor di `mobile/`, plus checklist verifikasi di perangkat fisik.

- Backend produksi: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Rencana & status: [PLAN.md](../PLAN.md) §10.5, §12.4

---

## 1. Prasyarat

- Android Studio + **JDK 17** + Android SDK (compileSdk 36).
- `mobile/node_modules` terpasang (`npm install`).
- `mobile/.env` berisi `VITE_API_BASE_URL` **produksi** (HTTPS), mis.
  `https://api.example.com/api/v1`.

---

## 2. Menyiapkan Build Web

```bash
cd mobile
npm install
npm run lint
npm run test.unit
npm run build
npx cap sync android
```

`npx cap sync android` menyalin aset web ke proyek Android dan mendaftarkan plugin
native (termasuk printer thermal). Jalankan setiap kali kode web berubah.

---

## 3. Menaikkan Versi

Edit `mobile/android/app/build.gradle`:

```gradle
versionCode 2          // naikkan 1 setiap rilis (harus selalu bertambah)
versionName "1.1"      // versi yang ditampilkan ke pengguna
```

`versionCode` tidak boleh turun, termasuk saat rilis ke Google Play.

---

## 4. Membuat Keystore (sekali saja)

```bash
keytool -genkey -v \
  -keystore mobile/android/warung-release.keystore \
  -alias warung \
  -keyalg RSA -keysize 2048 -validity 10000
```

Simpan keystore + password di tempat aman (mis. password manager).
**Jangan commit** ke Git — `android/.gitignore` sudah mengabaikan `*.keystore`,
`*.jks`, dan `keystore.properties`.

Buat `mobile/android/keystore.properties`:

```properties
storeFile=warung-release.keystore
storePassword=<password>
keyAlias=warung
keyPassword=<password>
```

`app/build.gradle` membaca file ini otomatis. Bila file tidak ada, build release
tetap jalan tetapi menghasilkan APK **tanpa tanda tangan** (tidak bisa dipasang di
perangkat tanpa penanganan tambahan).

---

## 5. Build Release

Lewat baris perintah:

```bash
cd mobile/android
./gradlew clean

# APK (untuk pemasangan langsung / distribusi internal)
./gradlew assembleRelease
# hasil: app/build/outputs/apk/release/app-release.apk

# AAB (untuk Google Play)
./gradlew bundleRelease
# hasil: app/build/outputs/bundle/release/app-release.aab
```

Atau lewat Android Studio: **Build → Generate Signed Bundle / APK**.

Verifikasi tanda tangan:

```bash
apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk
```

Pasang ke perangkat uji:

```bash
adb install -r app/build/outputs/apk/release/app-release.apk
```

---

## 6. Verifikasi di Perangkat Fisik

Kerjakan dengan **API produksi** dan satu perangkat Android nyata.

### Katalog & Price Checker
- [ ] Daftar/login (token tersimpan setelah app ditutup).
- [ ] Tambah produk (dengan & tanpa barcode), edit, arsipkan.
- [ ] Pindai barcode → harga benar; barcode tak dikenal → tawaran tambah produk.
- [ ] Perubahan dari perangkat lain terlihat setelah refresh.
- [ ] Perangkat lain (akun berbeda) tidak melihat data pengguna ini.

### POS
- [ ] Keranjang, ubah kuantitas, hapus item.
- [ ] Diskon + pembayaran; total/kembalian sesuai hitungan server.
- [ ] Bayar di bawah total ditolak.
- [ ] Klik **Bayar** dua kali / retry jaringan → hanya **satu** transaksi.
- [ ] Riwayat & detail menampilkan snapshot harga saat transaksi.

### Offline
- [ ] Mode pesawat → tambah produk → tersimpan "Menunggu".
- [ ] Online kembali → antrean tersinkron otomatis tanpa duplikat.

### Printer Termal (PLAN.md §10.5)
- [ ] Bluetooth: pasangkan printer, "Cari perangkat", pilih, **Cetak uji**.
- [ ] USB OTG: sambungkan printer, "Cari perangkat", izinkan USB, **Cetak uji**.
- [ ] WiFi/LAN: isi IP + port 9100, **Cetak uji**.
- [ ] Cetak struk nyata: lebar **58 mm** dan **80 mm** (baris tidak melebihi lebar kertas).
- [ ] Cetak ulang dari detail transaksi — tidak membuat transaksi baru.
- [ ] Matikan printer saat mencetak → error jelas, **transaksi tetap tersimpan**.

### Ketahanan
- [ ] Jaringan lambat/putus di tengah checkout → pesan jelas, tidak ada data separuh.
- [ ] Token kedaluwarsa/logout di perangkat lain → app meminta login ulang.

---

## 7. Catatan Plugin Printer

`@devlas/capacitor-thermal-printer` menarik `usb-serial-for-android` (via JitPack)
dan `kotlin-stdlib` 2.2.10. Bila build native pertama gagal dengan konflik versi:

1. Jalankan `./gradlew :app:dependencies` untuk melihat konflik.
2. Selaraskan versi Kotlin Gradle Plugin proyek dengan `2.2.10`.
3. Pastikan `https://jitpack.io` ada di daftar repository (dideklarasikan modul plugin).

---

## 8. Distribusi Internal

- APK langsung: bagikan `app-release.apk` (aktifkan "Instal dari sumber tidak dikenal").
- Google Play: unggah AAB ke **Internal testing** lebih dulu, lalu naikkan bertahap.
