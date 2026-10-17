# Personal POS & Price Checker

Aplikasi Android untuk mengelola katalog produk, mengecek harga lewat scan barcode, dan mencatat transaksi penjualan sederhana (POS) dengan cetak struk via printer thermal (Bluetooth, USB, atau WiFi).

> **Satu kode per produk.** SKU dan barcode adalah hal yang sama: kode boleh digenerate otomatis, diketik manual, atau diisi otomatis dari hasil scan. Lihat [PLAN.md §7](./PLAN.md).

> **Fokus MVP:** Price Checker + Katalog → POS + Cetak Struk.
> Baca [PLAN.md](./PLAN.md) untuk rencana lengkap.

## Struktur Repository

```text
Warung/
├── backend/   # Laravel REST API + PostgreSQL
├── mobile/    # Ionic React + Capacitor (Android)
├── docs/      # Dokumentasi tambahan
└── PLAN.md    # Rencana MVP
```

## Tech Stack

- **Mobile:** Ionic React, TypeScript, Capacitor, React Router, TanStack Query, React Hook Form, Zod
- **Backend:** Laravel, PostgreSQL, Laravel Sanctum
- **Hardware:** Barcode scanner (kamera), printer thermal (Bluetooth SPP / USB OTG / WiFi) dengan ESC/POS
- **Penyimpanan aman:** token auth di Android Keystore (AES-GCM); antrean offline di SQLite

## Status

- **Phase 1 — Project Foundation:** selesai.
- **Phase 2 — Product Catalog:** selesai (API + layar Produk).
- **Phase 3 — Price Checker:** selesai (layar Cek Harga, lookup barcode, alur tidak ditemukan, integrasi scanner ke form produk).
- **Phase 4 — Cloud Sync:** selesai (status koneksi, banner offline, refetch saat pulih, pull-to-refresh, invalidation, isolasi data terverifikasi).
- **Phase 4.5 — Antrean Offline (durable queue):** selesai (perubahan produk saat offline disimpan permanen di perangkat dan disinkron otomatis saat online kembali).
- **Phase 5 — POS:** selesai (keranjang, kuantitas, diskon, pembayaran & kembalian, transaksi atomik dengan idempotency key, snapshot item, riwayat & detail).
- **Phase 6 — Cetak Struk:** selesai pada level kode (encoder ESC/POS 58/80 mm + transport Bluetooth/USB/WiFi + pengaturan printer + cetak uji + cetak & cetak ulang). **Verifikasi pada printer fisik masih tertunda.**
- **Phase 7 — Stabilisasi & Rilis:** selesai pada level kode & dokumentasi (rate limiting, konfigurasi produksi, prosedur backup/restore, scaffolding signing rilis Android, checklist acceptance). **Build APK debug sudah diverifikasi; build APK release bertanda tangan serta uji perangkat/printer masih tertunda.**
- **Penyimpanan token aman:** selesai (Android Keystore + AES-GCM, migrasi otomatis dari Preferences).
- **Phase 8 — Resolusi Konflik Multi-Perangkat (P2):** selesai pada level kode & test (kolom
  `version`, `409 CONFLICT` + baris server terkini, item bentrok diparkir di antrean, dialog
  perbandingan per-field). **Uji dua perangkat masih tertunda.**
- **Phase 9 — Penyatuan SKU & Redesain UI:** selesai pada level kode & test (satu kolom `sku`
  menggantikan SKU+barcode, lookup `?sku=`, `GET /products/next-sku`, SKU boleh dipakai ulang
  setelah diarsipkan, metode pembayaran Tunai/Non Tunai end-to-end, sistem desain biru baru, dan
  navigasi Splash → Login → 4 tab + halaman Cek Harga/Pembayaran/Struk). **Verifikasi perangkat
  menyusul.**

Semua fase MVP sudah dikerjakan. Sisa pekerjaan hanya verifikasi perangkat keras/Android yang
memerlukan SDK dan printer fisik — lihat [docs/RELEASE-ANDROID.md](./docs/RELEASE-ANDROID.md).

Lihat §13 di [PLAN.md](./PLAN.md) untuk roadmap lengkap.

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [PLAN.md](./PLAN.md) | Rencana lengkap, scope, desain API/DB, roadmap per fase |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Deploy backend produksi, konfigurasi, backup & restore PostgreSQL |
| [docs/RELEASE-ANDROID.md](./docs/RELEASE-ANDROID.md) | Signing, build APK/AAB release, checklist verifikasi perangkat |

## Antrean Offline (Write Queue)

Perubahan katalog (tambah/edit/arsip produk) bersifat **online-first** namun tahan offline:

- Saat online, penyimpanan langsung dikirim ke server.
- Saat offline (atau gagal jaringan), perubahan disimpan **permanen** di perangkat:
  - Android: SQLite (`@capacitor-community/sqlite`, database `warung`, tabel `outbox`).
  - Web/preview: `localStorage` (fallback durable).
- Begitu online kembali (atau saat app dibuka), antrean **disinkron otomatis** secara berurutan.
- Retry aman dari duplikasi: pembuatan produk memakai header `Idempotency-Key`, sehingga percobaan ulang tidak membuat produk ganda.
- Perubahan yang menunggu langsung terlihat di daftar (overlay optimistis, badge **Menunggu**).
- Indikator awan di header menampilkan jumlah perubahan tertunda; item yang ditolak server (4xx) ditandai **gagal** dan bisa dicoba ulang atau dibuang.

## Resolusi Konflik Multi-Perangkat

Bila produk yang sama diubah dari dua perangkat, perubahan **tidak** saling menimpa diam-diam:

- Server menyimpan revisi tiap produk (`version`). Aplikasi mengirim versi yang menjadi
  dasar edit; bila server sudah lebih baru, API menjawab `409 CONFLICT` beserta baris terkini.
- Percobaan ulang yang sebenarnya sudah berhasil (mis. response hilang) **tidak** dilaporkan
  sebagai konflik — nilainya sudah sama, jadi server menganggapnya berhasil.
- Perubahan yang bentrok **diparkir** di antrean perangkat (status konflik), bukan hilang.
  Indikator awan di header memerah dan tombol **Tinjau bentrok** membuka perbandingan per-field.
- Pengguna memilih **Pakai versi server** (buang edit lokal) atau **Simpan milik saya**
  (kirim ulang dengan `force`).

> Snapshot transaksi dan perhitungan harga di server tidak berubah: aturan ini hanya untuk katalog.

> Pemindaian kamera hanya aktif di aplikasi Android (`npx cap run android`).
> Di preview browser, tombol pindai menampilkan pesan agar pengguna memakai input manual.

## Prasyarat

- Node.js >= 20, npm/pnpm
- PHP >= 8.5, Composer
- PostgreSQL >= 15 (produksi; lokal bisa pakai SQLite)
- Android Studio + JDK 21 (untuk build Android; Capacitor 8 menargetkan Java 21)

## Menjalankan Backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate        # lokal memakai SQLite (database/database.sqlite)
php artisan serve          # http://localhost:8000
php artisan test           # jalankan test
```

Untuk memakai PostgreSQL, set `DB_CONNECTION=pgsql` dan variabel `DB_*` di `.env`
(lihat contoh di `backend/.env.example`), lalu jalankan `php artisan migrate`.

## Menjalankan Mobile

```bash
cd mobile
npm install
cp .env.example .env       # sesuaikan VITE_API_BASE_URL
npm run dev                # server pengembangan Vite
npm run build              # build produksi
npm run lint               # eslint
npm run test.unit          # vitest
npx cap sync android       # sinkronkan ke proyek Android
npx cap open android       # buka di Android Studio
```

> Saat menguji di emulator Android, `localhost` mengarah ke perangkat itu sendiri.
> Gunakan `http://10.0.2.2:8000/api/v1` sebagai `VITE_API_BASE_URL`.

## Kontrak API

Base URL: `/api/v1`. Endpoint yang sudah tersedia:

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/auth/register` | Registrasi |
| POST | `/auth/login` | Login |
| POST | `/auth/logout` | Logout |
| GET | `/me` | Profil pengguna |
| GET | `/products` | Daftar & pencarian produk (`search`, `category_id`, `sort`, pagination) |
| POST | `/products` | Membuat produk (SKU otomatis bila kosong; mendukung header `Idempotency-Key`) |
| GET | `/products/next-sku` | Saran SKU berikutnya untuk ditampilkan di form |
| GET | `/products/{id}` | Detail produk |
| PATCH | `/products/{id}` | Update produk (kirim `version` untuk deteksi konflik; `409` + `force` bila bentrok) |
| DELETE | `/products/{id}` | Arsipkan produk |
| GET | `/products/lookup?sku=` | Lookup produk dari kode hasil scan |
| GET | `/categories` | Daftar kategori |
| POST | `/categories` | Membuat kategori |
| PATCH | `/categories/{id}` | Mengubah nama kategori |
| DELETE | `/categories/{id}` | Menghapus kategori (produknya jadi tanpa kategori) |
| POST | `/transactions` | Simpan transaksi (atomik; mendukung header `Idempotency-Key`) |
| GET | `/transactions` | Daftar transaksi (`search`, `payment_method`, pagination) |
| GET | `/transactions/{id}` | Detail transaksi |
| GET | `/transactions/{id}/receipt` | Data untuk cetak struk |

Semua error memakai envelope `{ "error": { "code", "message", "details?" } }`.

## Layar & Navigasi

Alurnya: **Splash → Login → 4 tab utama**, dengan empat halaman yang dibuka penuh (tab bar
tersembunyi): **Cek Harga**, **Pembayaran**, **Preview Struk**, dan **Kelola Kategori**.

| Layar | Isi |
|---|---|
| **Beranda** | Sapaan, 4 kartu aksi cepat (Cek Harga · Tambah Produk · Kasir · Riwayat), produk terbaru |
| **Cek Harga** | Bingkai kamera + tombol **Pindai Barcode**, pencarian nama/SKU, kartu hasil + **Tambahkan ke Keranjang** |
| **Produk** | Pencarian, chip kategori, pemilih urutan, daftar produk (thumbnail · nama · SKU · harga), modal detail, tombol **+**; tombol kategori di kanan judul membuka **Kelola Kategori** |
| **Kelola Kategori** | Tambah, ubah nama, dan hapus kategori. Menghapus kategori tidak menghapus produknya — produknya hanya jadi tanpa kategori |
| **POS** | Pencarian/scan, hasil pencarian tampil sebagai popup di atas keranjang, keranjang dengan stepper kuantitas, subtotal, **Lanjut ke Pembayaran** |
| **Pembayaran** | Ringkasan pesanan, metode **Tunai/Non Tunai**, nominal dibayar (+pintasan), kembalian, **Bayar** |
| **Preview Struk** | Kartu struk bergaya kertas + **Cetak Struk** + teks printer |
| **Riwayat** | Pencarian nomor, chip metode pembayaran, daftar transaksi (nomor · waktu · total · badge metode), detail & cetak ulang |

Sistem desainnya biru `#2563EB` di atas latar `#F4F6FA`: kartu putih bersudut bulat, tombol utama
biru selebar penuh, bar pencarian berbentuk pil, chip filter, dan badge status
(`mobile/src/theme/variables.css` + `mobile/src/theme/app.css`).

Chrome-nya **bukan navbar Ionic**: setiap layar (dan setiap modal) memakai komponen
`PageHeader` — panah kembali + judul + aksi opsional yang menyatu dengan isi halaman. Panah
kembali disembunyikan hanya di **Beranda** (akar aplikasi). Tipografinya **Plus Jakarta Sans**
di-bundle lokal lewat `@fontsource-variable/plus-jakarta-sans`, jadi tetap tampil tanpa jaringan.
Teks printer pada **Preview Struk** tetap monospace supaya kolom 32/48 karakter tidak bergeser.

> Form produk memakai **satu kolom “SKU / Barcode”** dengan tombol generate (saran dari server)
> dan tombol scan. Foto produk tidak dipakai di versi ini; kolom Catatan disembunyikan dari form
> (kolom `notes` tetap ada di API).

## POS (Kasir)

- Tab **POS**: cari produk atau pindai barcode untuk menambah ke keranjang, atur kuantitas, lalu **Lanjut ke Pembayaran**. Hasil pencarian muncul sebagai **popup** di atas keranjang (latar digelapkan) sehingga daftar keranjang tidak bergeser; pilih produk untuk memasukkannya, dan kolom cari otomatis dikosongkan lagi. Keranjang disimpan di provider bersama (memori), jadi produk dari **Cek Harga** ikut masuk.
- **Kelola Kategori**: dibuka dari tombol di kanan judul **Katalog Produk**. Kategori bisa ditambah, diubah namanya, dan dihapus. Menghapus kategori tidak menghapus produk — `category_id` produknya menjadi kosong (`nullOnDelete`).
- Halaman **Pembayaran**: pilih metode **Tunai** atau **Non Tunai**, isi nominal dibayar (ada pintasan **Uang pas**/20rb/50rb/100rb) dan lihat kembalian. Nominal yang diketik tampil dengan pemisah ribuan. Non tunai dianggap pas (kembalian 0).
- Semua perhitungan (`subtotal`, `total`, kembalian) dilakukan **backend** dari harga produk di server — bukan dari klien.
- Item transaksi disimpan sebagai **snapshot** (nama/SKU/harga saat transaksi), sehingga perubahan harga tidak mengubah riwayat.
- Checkout memakai `Idempotency-Key` (satu kunci per isi keranjang) agar percobaan ulang tidak membuat transaksi ganda.
- Setelah berhasil, aplikasi membuka **Preview Struk** dengan tombol cetak.
- Tab **Riwayat**: daftar transaksi (pagination, pull-to-refresh, pencarian nomor, filter metode) dan detail item/pembayaran.
- Checkout memerlukan koneksi (server-authoritative). Antrean transaksi offline termasuk P2.

## Cetak Struk (Printer Thermal)

Didukung **Bluetooth SPP**, **USB (OTG)**, dan **WiFi/LAN (TCP 9100)** lewat plugin
`@devlas/capacitor-thermal-printer` (mengirim bytes ESC/POS mentah). Pencetakan hanya aktif di
aplikasi Android; di browser struk ditampilkan sebagai **pratinjau** teks.

- Buka **ikon printer** di tab **Riwayat** (atau di tab **POS**).
- Pilih **lebar kertas** (58 mm = 32 kolom, 80 mm = 48 kolom), isi nama toko/alamat/footer.
- Pilih **jenis koneksi**:
  - **Bluetooth**: pasangkan printer di pengaturan Android dulu, lalu "Cari perangkat" dan pilih printer.
  - **USB (OTG)**: sambungkan printer, lalu "Cari perangkat". Izin USB diminta otomatis.
  - **WiFi/LAN**: isi alamat IP printer dan port (default `9100`).
- Tekan **Cetak uji** untuk memastikan printer bekerja, lalu **Simpan** sebagai printer default.
- Cetak struk dari **Preview Struk** (setelah **Bayar**) atau dari **detail transaksi** di Riwayat.
- Cetak ulang tidak mengubah transaksi — struk selalu dirender dari snapshot transaksi di server.

Struk dibuat oleh encoder lokal (`mobile/src/lib/receipt`) yang memisahkan model layout dari
renderer, sehingga lebar 58/80 mm bisa diuji otomatis tanpa perangkat keras
(`npm run test.unit`).

> **Belum diverifikasi di perangkat fisik.** Karena lingkungan pengembangan ini tidak punya
> Android SDK/printer, langkah build + uji cetak nyata ada di
> [PLAN.md §10.5](./PLAN.md). Catatan: plugin menarik `usb-serial-for-android` (JitPack) dan
> `kotlin-stdlib` 2.2.10 — sesuaikan versi Gradle/Kotlin bila build native pertama konflik.

