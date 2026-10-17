# Rilis Aplikasi Android

Panduan menandatangani (sign) dan membangun APK/AAB release untuk aplikasi Ionic +
Capacitor di `mobile/`, plus checklist verifikasi di perangkat fisik.

- Backend produksi: [DEPLOYMENT.md](./DEPLOYMENT.md)
- Rencana & status: [PLAN.md](../PLAN.md) §10.5, §12.4

---

## 1. Prasyarat

- Android Studio + **JDK 21** + Android SDK (compileSdk 36). Capacitor 8 menyetel
  `sourceCompatibility`/`targetCompatibility` ke Java 21 di
  `android/app/capacitor.build.gradle`, jadi JDK 17 tidak cukup — kalau mesin hanya punya
  JDK 17, unduh Temurin 21 ke folder lokal lalu arahkan `JAVA_HOME` ke sana saat memanggil
  Gradle. Tanpa itu build berhenti di `:capacitor-android:compileDebugJavaWithJavac`
  dengan `error: invalid source release: 21`.
- `ANDROID_HOME` (atau `sdk.dir` di `android/local.properties`) menunjuk ke Android SDK yang
  berisi `platforms/android-36` dan `build-tools/36.0.0`.
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

### Build debug untuk server HTTP di jaringan (LAN / Tailscale)

APK **release** wajib HTTPS (lihat §1). Untuk menguji build **debug** terhadap server
Laravel yang berjalan dengan HTTP polos di laptop:

```bash
# backend: bind ke semua interface
php artisan serve --host=0.0.0.0 --port=8000
# mobile: VITE_API_BASE_URL = http://<ip-laptop>:8000/api/v1  (LAN atau IP Tailscale)
npm run build
npm run sync:lan                                        # = CAP_ALLOW_HTTP=1 cap sync android
cd android && ./gradlew assembleDebug
```

Halaman aplikasi dimuat WebView dari `https://localhost`, jadi request ke API HTTP polos
terhitung *mixed content* sekaligus *cleartext*. Dua hal ini yang membukanya, dan
keduanya **hanya berlaku di build debug**:

- `npm run sync:lan` menulis `allowMixedContent: true` ke `capacitor.config.json`
  (sync biasa tetap `false`).
- `android/app/src/debug/AndroidManifest.xml` menyetel `usesCleartextTraffic="true"`.

Sudah diverifikasi lewat `aapt2 dump xmltree`: APK debug memuat keduanya, sedangkan APK
release tidak punya `usesCleartextTraffic` dan tetap `allowMixedContent: false`.

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
- [ ] Splash → Login; token tersimpan setelah app ditutup, dan sesi tetap aktif saat backend
      tidak terjangkau (hanya logout atau `401` yang memaksa login ulang).
- [ ] Beranda: sapaan, kartu aksi cepat, produk terbaru.
- [ ] Tambah produk (SKU digenerate, diketik manual, dan diisi dari scan), edit, arsipkan.
- [ ] SKU yang diarsipkan bisa dipakai ulang untuk produk baru.
- [ ] Pindai barcode → harga benar; kode tak dikenal → tawaran tambah produk (SKU terisi).
- [ ] Cari di **Cek Harga** dan **Katalog Produk**; urutkan katalog (Terbaru/Nama/Harga).
- [ ] Halaman Cek Harga / Pembayaran / Struk tidak menampilkan tab bar.
- [ ] Cek Harga: pratinjau kamera hidup di dalam app dan hasil pindai langsung muncul; tombol
      **Pindai Barcode** (UI kamera native ML Kit) juga masih berfungsi. Saat izin kamera
      ditolak, muncul pesan jelas dan tombol ML Kit tetap bisa dipakai.
- [ ] Cek Harga: **beep** terdengar dan perangkat **bergetar** tepat saat barcode terbaca
      (volume media perangkat naik; beep ikut volume media, bukan volume alarm).
- [ ] Perubahan dari perangkat lain terlihat setelah refresh.
- [ ] Perangkat lain (akun berbeda) tidak melihat data pengguna ini.

### POS
- [ ] Keranjang, ubah kuantitas, hapus item; tambah item dari Cek Harga.
- [ ] Pembayaran Tunai & Non Tunai; total/kembalian sesuai hitungan server.
- [ ] Metode **Tunai** dan **Non Tunai** tersimpan; filter Riwayat bekerja.
- [ ] Bayar di bawah total ditolak.
- [ ] Klik **Bayar** dua kali / retry jaringan → hanya **satu** transaksi.
- [ ] Riwayat & detail menampilkan snapshot SKU/harga saat transaksi.

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
dan `kotlin-stdlib` 2.2.10.

- **JitPack wajib ada di root `allprojects { repositories }`** (`mobile/android/build.gradle`).
  Modul plugin memang mendeklarasikan `https://jitpack.io` di `build.gradle` miliknya sendiri,
  tetapi repositori modul tidak diwariskan ke project yang mengonsumsinya — akibatnya `:app`
  berhenti dengan `Could not find com.github.mik3y:usb-serial-for-android:3.11.0`. Sudah
  diperbaiki di repo; jangan hapus baris itu saat memperbarui plugin.
- Capacitor 8 menargetkan **Java 21**. Dengan JDK 17 build berhenti di
  `:capacitor-android:compileDebugJavaWithJavac` (`error: invalid source release: 21`).
- Bila muncul konflik versi Kotlin, jalankan `./gradlew :app:dependencies` lalu selaraskan versi
  Kotlin Gradle Plugin proyek dengan `2.2.10`.
- `./gradlew assembleDebug` sudah diverifikasi berhasil (JDK 21 + Android SDK 36) dan
  menghasilkan `app/build/outputs/apk/debug/app-debug.apk` ±38 MB berisi aset web di
  `assets/public/`.

---

## 8. Distribusi Internal

- APK langsung: bagikan `app-release.apk` (aktifkan "Instal dari sumber tidak dikenal").
- Google Play: unggah AAB ke **Internal testing** lebih dulu, lalu naikkan bertahap.
