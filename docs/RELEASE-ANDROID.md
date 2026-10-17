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

`mobile/.env` menentukan API mana yang dipanggil. Untuk build yang dipasang di HP,
arahkan ke server: `VITE_API_BASE_URL=https://pos.syamlab.my.id/api/v1` (lihat
[PLAN.md §17](../PLAN.md) soal servernya).

### Build debug untuk server HTTP di jaringan (LAN / Tailscale)

Hanya perlu bila menguji terhadap backend Laravel yang berjalan dengan HTTP polos di
laptop — server produksi sudah HTTPS, jadi build debug biasa tidak butuh langkah ini.

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
versionName "1.1.0"    // versi yang ditampilkan ke pengguna
```

`versionCode` tidak boleh turun, termasuk saat rilis ke Google Play.

Setelah build selesai, terbitkan ke backend supaya aplikasi yang sudah terpasang ditawari versi
baru — lihat §8.

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
- [ ] Cek Harga: tombol **mikrofon** → izin mikrofon diminta sekali → sebut “susu” → kolom
      pencarian terisi dan daftar produk bermunculan. Coba juga “cari susu” (kata perintahnya
      harus dibuang). Tolak izinnya sekali → muncul pesan yang menjelaskan, bukan gagal diam.
- [ ] Halaman Cek Harga / Pembayaran / Struk / Notifikasi tidak menampilkan tab bar.
- [ ] Cek Harga: pratinjau kamera hidup di dalam app dan hasil pindai langsung muncul; tombol
      **Pindai Barcode** (UI kamera native ML Kit) juga masih berfungsi. Saat izin kamera
      ditolak, muncul pesan jelas dan tombol ML Kit tetap bisa dipakai.
- [ ] Cek Harga: **beep** terdengar dan perangkat **bergetar** tepat saat barcode terbaca
      (volume media perangkat naik; beep ikut volume media, bukan volume alarm).
- [ ] Cek Harga: barcode yang belum terdaftar menampilkan panel di halaman dan kamera tetap
      hidup — memindai barcode berikutnya langsung berhasil tanpa keluar dari halaman.
- [ ] Cek Harga: barang di luar bingkai tidak terbaca (bukti pemotongan area bingkai bekerja),
      dan tombol **Lampu** muncul hanya di perangkat yang punya torch.
- [ ] Impor dari Excel: siapkan `.xlsx` berisi kolom **Nama** dan **Harga** (plus SKU/Satuan/
      Kategori/Catatan bila ada) → **Produk → tombol impor** → pratinjau menyebut jumlah baris
      siap diimpor dan baris yang dilewati → **Impor** → produk muncul di katalog dengan harga
      yang benar.
- [ ] Impor ulang berkas yang sama **tanpa** centang "Perbarui produk yang sudah ada" → semua
      baris dilewati (produk tidak berganda). Coba lagi **dengan** centang → harga ikut berubah.
- [ ] Impor saat mode pesawat → tombol impor menunggu koneksi dan memberi tahu, bukan gagal diam.
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
- [ ] Tombol **Keluar** di Beranda (kartu Akun) → konfirmasi muncul; "Batal" tetap masuk;
      "Keluar" kembali ke halaman masuk.
- [ ] Keluar saat ada perubahan produk yang belum tersinkron → dialog menyebut jumlahnya, dan
      perubahan itu tidak terkirim ke akun berikutnya.
- [ ] Masuk lagi setelah keluar → keranjang kosong (tidak mewarisi keranjang akun sebelumnya).

### Notifikasi pembaruan (PLAN.md §16)
- [ ] Terbitkan satu rilis dengan `versionCode` lebih tinggi → buka aplikasi → **lonceng di baris
      sapaan Beranda bertanda titik**.
- [ ] Buka lonceng → halaman **Notifikasi** memuat kabar **Versi x.y.z tersedia** (catatan rilis,
      ukuran, tanggal terbit) → kembali → titik di lonceng sudah hilang.
- [ ] Tekan **Perbarui** → browser terbuka dan APK-nya terunduh → berkas bisa dipasang
      (menimpa aplikasi lama, data & sesi login tetap ada).
- [ ] Tekan **Nanti** → kabar hilang dan tetap hilang setelah aplikasi dibuka ulang.
- [ ] Matikan backend → aplikasi tetap jalan normal tanpa pesan error soal pembaruan.

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

### Notifikasi pembaruan (yang sudah terpasang ikut diberi tahu)

Cara tercepat — satu perintah dari akar repo:

```bash
scripts/rilis.sh "Perbaikan pemindai barcode"
```

Skrip itu menaikkan versi, build APK, dan menerbitkannya **ke server** (container Docker di
`homeserver@main`) sekaligus — lihat `--help` untuk opsi, dan `--lokal` bila backend-nya justru
jalan di laptop. Langkah manualnya kalau diperlukan:

```bash
# kirim APK ke server, lalu terbitkan dari dalam container
scp ~/Downloads/warung-pos-debug.apk homeserver@main:/home/homeserver/warung/incoming/apk
ssh homeserver@main 'cd ~/warung/backend \
  && docker compose cp ../../warung/incoming/apk app:/tmp/apk \
  && docker compose exec -T app php artisan release:publish /tmp/apk \
       --version-code=7 --version-name=1.1.5 --notes="Perbaikan pemindai barcode"'
```

Di server, `versionCode`/`versionName` **tidak** bisa dibaca otomatis (proyek mobile tidak ada di
sana), jadi kirim lewat `--version-code`/`--version-name`. Perintah ini menyalin APK ke
`storage/app/private/releases/` di dalam volume `app-storage` dan mencatatnya di tabel
`app_releases`.

Mulai saat itu, setiap aplikasi yang terpasang dan terhubung ke backend akan menandai lonceng di
Beranda saat dibuka; halaman **Notifikasi** memuat kabar **Versi x.y.z tersedia** dengan tombol
**Perbarui** (mengunduh APK lewat browser, lalu pengguna menekan *Pasang*) dan **Nanti**
(menghilangkan kabar versi itu). Rinciannya di [PLAN.md §16](../PLAN.md).

Hal yang perlu diingat:

- Aplikasi membandingkan **`versionCode`**, bukan nama versi. Rilis dengan `versionCode` lebih kecil
  atau sama tidak akan pernah ditawarkan.
- Berkas APK disimpan di volume `app-storage` container (`storage/app/private/releases/` di
  dalamnya) — tidak ikut git, dan tidak perlu symlink `public/storage`.
- Selama backend tidak bisa dihubungi, tidak ada notifikasi apa pun — aplikasi tetap jalan normal.
- Pembaruan menimpa aplikasi lama hanya bila ditandatangani dengan **kunci yang sama**. Kunci debug
  sudah stabil per mesin; begitu pindah ke keystore rilis (§4), pengguna perlu memasang ulang sekali
  (uninstall dulu).
