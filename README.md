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
├── scripts/   # rilis.sh — terbitkan versi baru dalam satu perintah
└── PLAN.md    # Rencana MVP
```

## Tech Stack

- **Mobile:** Ionic React, TypeScript, Capacitor, React Router, TanStack Query, React Hook Form, Zod
- **Backend:** Laravel, PostgreSQL, Laravel Sanctum
- **Hardware:** Barcode scanner (kamera), printer thermal (Bluetooth SPP / USB OTG / WiFi) dengan ESC/POS
- **Pencarian suara:** pengenal suara native perangkat lewat `@capacitor-community/speech-recognition` (bahasa Indonesia), di halaman Cek Harga
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
- **Penyimpanan token aman & sesi menempel (sticky):** selesai (Android Keystore + AES-GCM, migrasi otomatis dari Preferences). Profil pengguna ikut disimpan, jadi setelah sekali login aplikasi langsung terbuka di Beranda — termasuk saat backend tidak terjangkau. Sesi hanya berakhir bila pengguna menekan **Keluar** atau server menolak token (`401`); kegagalan jaringan tidak pernah mengeluarkan pengguna.
- **Phase 8 — Resolusi Konflik Multi-Perangkat (P2):** selesai pada level kode & test (kolom
  `version`, `409 CONFLICT` + baris server terkini, item bentrok diparkir di antrean, dialog
  perbandingan per-field). **Uji dua perangkat masih tertunda.**
- **Phase 9 — Penyatuan SKU & Redesain UI:** selesai pada level kode & test (satu kolom `sku`
  menggantikan SKU+barcode, lookup `?sku=`, `GET /products/next-sku`, SKU boleh dipakai ulang
  setelah diarsipkan, metode pembayaran Tunai/Non Tunai end-to-end, sistem desain biru baru, dan
  navigasi Splash → Login → 4 tab + halaman Cek Harga/Pembayaran/Struk). **Verifikasi perangkat
  menyusul.**
- **Notifikasi pembaruan aplikasi:** selesai pada level kode & test (rilis APK disimpan di
  backend lewat `php artisan release:publish`, endpoint publik `GET /app/release`, halaman
  **Notifikasi** yang dibuka dari lonceng di Beranda). Terverifikasi end-to-end di browser:
  lonceng bertanda saat kabar belum dibuka, kabar berisi catatan rilis + ukuran + tanggal terbit,
  membukanya menghilangkan tanda, "Nanti" menutup kabar itu (dan tetap tertutup setelah aplikasi
  dibuka ulang), versi berikutnya ditawarkan lagi, dan tombol Perbarui benar-benar mengunduh
  APK-nya.
- **Impor produk dari Excel:** selesai pada level kode & test (berkas `.xlsx`/`.csv` dibaca di
  dalam aplikasi, ditinjau dulu, lalu dikirim ke `POST /products/import`). Terverifikasi
  end-to-end di browser dengan berkas `.xlsx` sungguhan: pratinjau menghitung baris, baris rusak
  dilaporkan dengan nomor barisnya, harga bertulisan `Rp 2.500` tersimpan sebagai angka, kategori
  baru ikut dibuat, dan impor ulang tanpa centang "perbarui" hanya melewati baris yang sudah ada.
- **Keluar / ganti akun:** selesai pada level kode & test (kartu Akun di Beranda dengan dialog
  konfirmasi). Keluar menghapus token & profil, membersihkan cache data server, mengosongkan
  keranjang, dan membuang antrean perubahan offline setelah jumlahnya diberitahukan. Terverifikasi
  end-to-end di browser (9 pemeriksaan, termasuk masuk lagi → keranjang kosong dan perubahan
  offline tidak terkirim).
- **Pencarian suara di Cek Harga:** selesai pada level kode & test (tombol mikrofon, bahasa
  Indonesia, pembersihan kata perintah, pesan galat yang bisa ditindaklanjuti untuk izin
  ditolak / tidak terdengar / butuh internet / perangkat tanpa pengenal suara). **Uji mikrofon
  pada perangkat fisik masih tertunda.**

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
- Docker + Docker Compose v2 (untuk menjalankan backend di server)
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

Agar bisa diakses dari HP (bukan hanya laptop), bind ke semua interface:

```bash
php artisan serve --host=0.0.0.0 --port=8000
```

Untuk memakai PostgreSQL, set `DB_CONNECTION=pgsql` dan variabel `DB_*` di `.env`
(lihat contoh di `backend/.env.example`), lalu jalankan `php artisan migrate`.

## Deploy ke Server (Docker)

Server yang dipakai sekarang adalah homeserver pribadi: `pos.syamlab.my.id` masuk lewat
Cloudflare Tunnel ke **port 7001**, lalu diteruskan nginx di dalam container ke Laravel.

```bash
scripts/deploy-server.sh
```

Perintah itu:

1. menyalin folder `backend/` ke server (tanpa `vendor`, `.env`, dan data lokal),
2. membuat `backend/.env` **sekali saja** di server — `APP_KEY` dan sandi PostgreSQL
   diacak di situ dan tidak pernah ditimpa lagi, karena bergantinya `APP_KEY`
   membatalkan semua token yang beredar,
3. menjalankan `docker compose up -d --build` di server,
4. menunggu sampai API menjawab, lalu menampilkan status container.

Setelan yang bisa diubah lewat variabel lingkungan: `WARUNG_SERVER` (default
`homeserver@main`), `WARUNG_SERVER_DIR` (default `/home/homeserver/warung`),
`WARUNG_BASE_URL` (default `https://pos.syamlab.my.id`), dan `WARUNG_TUNNEL_TOKEN`
bila connector Cloudflare ikut dijalankan dari sini.

Isi `backend/compose.yaml`:

| Service | Isi |
|---|---|
| `app` | nginx + php-fpm dalam satu container; `7001:80`; volume `app-storage` untuk APK rilis, log, dan sesi |
| `db` | PostgreSQL 17; hanya dijangkau `app`; volume `db-data` |
| `tunnel` | connector Cloudflare (`--profile tunnel`); ikut jalan hanya kalau `TUNNEL_TOKEN` ada di `.env` |

Beberapa hal yang sengaja begitu:

- **Migrasi jalan sendiri** setiap container start; database yang masih kosong juga
  langsung diisi akun demo (`demo@warung.test` / `password`).
- **Tanpa `config:cache`.** Berkas `.env` hanya dibaca Laravel selama konfigurasi belum
  ter-cache, jadi cache yang tertinggal di image bisa membuat perubahan `.env` diabaikan
  pada deploy berikutnya. Di skala ini bedanya tidak terasa.
- **Rilis aplikasi disimpan di server**, bukan di laptop: `scripts/rilis.sh` mengirim APK
  ke container. Pakai `scripts/rilis.sh --lokal` untuk kembali menerbitkan ke backend lokal.

### Cloudflare Tunnel

Connector-nya ikut dijalankan kalau `TUNNEL_TOKEN` ada di `backend/.env` server:

```bash
WARUNG_TUNNEL_TOKEN='eyJ...' scripts/deploy-server.sh
```

Rute publiknya diatur di dashboard **Cloudflare Zero Trust → Networks → Tunnels**:
`pos.syamlab.my.id` → `http://app:80` (nama service di jaringan Compose; alternatifnya
`http://<ip-server>:7001`). Karena TLS diakhiri Cloudflare, `TRUSTED_PROXIES=*` sudah
disetel di `compose.yaml` supaya Laravel melihat skema `https` yang benar.

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

### Memasang APK di HP

**Ke server — cara biasa.** `mobile/.env` berisi
`VITE_API_BASE_URL=https://pos.syamlab.my.id/api/v1`, jadi build debug biasa sudah
menunjuk ke server rumah dan tidak perlu akal-akalan HTTP polos:

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
# APK: mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

Menerbitkan versi baru supaya HP yang sudah terpasang ikut diperbarui: lihat
[Pembaruan Aplikasi](#pembaruan-aplikasi-notifikasi-update) dan
[docs/RELEASE-ANDROID.md](./docs/RELEASE-ANDROID.md).

**Ke backend di laptop — hanya saat mengembangkan.** Backend lokal jalan di port 8000,
jadi arahkan aplikasi ke alamat laptop:

1. Jalankan backend di semua interface: `php artisan serve --host=0.0.0.0 --port=8000`.
2. Set `VITE_API_BASE_URL` ke alamat laptop yang bisa dijangkau HP — IP LAN
   (mis. `http://192.168.1.14:8000/api/v1`) atau **IP Tailscale**
   (mis. `http://100.112.0.37:8000/api/v1`) bila HP juga terpasang Tailscale,
   sehingga bisa diuji dari jaringan mana pun.
3. Build pakai sync khusus LAN:

```bash
npm run build
npm run sync:lan                                        # = CAP_ALLOW_HTTP=1 cap sync android
cd android && ./gradlew assembleDebug
```

Halaman aplikasi dimuat dari `https://localhost` sementara API-nya HTTP polos, jadi dua
hal perlu diizinkan — keduanya **hanya untuk build debug**:

- `npm run sync:lan` menulis `allowMixedContent: true` ke `capacitor.config.json`
  (sync biasa tetap `false`).
- `mobile/android/app/src/debug/AndroidManifest.xml` menyetel
  `usesCleartextTraffic="true"`.

Build release tidak memakai keduanya, sehingga APK produksi tetap menolak HTTP polos
dan wajib HTTPS. Build Android memerlukan JDK 21 (lihat
[docs/RELEASE-ANDROID.md](./docs/RELEASE-ANDROID.md) §1).

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
| POST | `/products/import` | Impor produk dari daftar yang sudah dibaca aplikasi (baris rusak dilaporkan per baris) |
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
| GET | `/app/release` | Rilis aplikasi terbaru (publik) — dipakai halaman Notifikasi |
| GET | `/app/release/download?version_code=` | Unduh berkas APK versi tersebut (publik) |

Semua error memakai envelope `{ "error": { "code", "message", "details?" } }`.

## Pembaruan Aplikasi (Notifikasi Update)

Aplikasi dipasang sebagai APK, jadi pembaruan tidak datang sendiri. Setiap kali dibuka, aplikasi
memeriksa `GET /app/release` dan membandingkan `version_code` terbaru di server dengan
`versionCode` miliknya sendiri:

- Ada versi lebih baru → **lonceng di baris sapaan Beranda** bertanda titik dan halaman
  **Notifikasi** memuat kabar **Versi x.y.z tersedia** lengkap dengan catatan rilis, ukuran berkas,
  tanggal terbit, tombol **Perbarui** (mengunduh APK-nya lewat browser) dan **Nanti**
  (menghilangkan kabar itu sampai ada versi lebih baru lagi).
- Belum ada rilis, offline, atau backend tidak menjawab → tidak ada notifikasi apa pun; aplikasi
  berjalan seperti biasa.

Membuka halaman Notifikasi berarti kabar itu sudah dibaca, jadi titik di lonceng hilang — tetapi
kabarnya tetap ada sampai dijawab **Perbarui** atau **Nanti**.

Menerbitkan versi baru — satu perintah dari akar repo:

```bash
scripts/rilis.sh "Perbaikan pemindai barcode"
```

Skrip itu menaikkan `versionCode` + `versionName` di proyek mobile, build APK, lalu
**mengirimkannya ke server** dan menjalankan `release:publish` di container. Versi terbit
sebelumnya dibaca dari database server, dan skrip menolak jalan kalau `versionCode` tidak lebih
baru dari rilis yang sudah terbit (aplikasi yang terpasang tidak akan ditawari). Skripnya juga
memilih sendiri JDK 21 yang dibutuhkan Capacitor. Pakai `scripts/rilis.sh --lokal "…"` bila
backend-nya justru jalan di laptop. Opsi lain (`--release`, `--tanpa-terbit`, `--versi`, `--naik`):
`scripts/rilis.sh --help`.

Kalau lebih suka manual, langkahnya tetap bisa dijalankan sendiri:

```bash
# 1. naikkan versionCode/versionName di mobile/android/app/build.gradle
# 2. build APK → ~/Downloads/warung-pos-debug.apk
# 3. kirim ke server dan terbitkan dari dalam container
scp ~/Downloads/warung-pos-debug.apk homeserver@main:/home/homeserver/warung/incoming/apk
ssh homeserver@main 'cd ~/warung/backend \
  && docker compose cp ../../warung/incoming/apk app:/tmp/apk \
  && docker compose exec -T app php artisan release:publish /tmp/apk \
       --version-code=7 --version-name=1.1.5 --notes="Perbaikan pemindai barcode"'
```

Pada `release:publish`, `versionCode`/`versionName` dibaca otomatis dari proyek mobile bila
tersedia (di server tidak, jadi kirim lewat `--version-code`/`--version-name` seperti contoh).
Perintah itu menyalin APK ke `storage/app/private/releases/` **di server** dan mencatatnya di
tabel `app_releases`; aplikasi yang sudah terpasang akan langsung ditawari versi tersebut.
Rincian lengkap:

- [PLAN.md §16](./PLAN.md) — alur & endpoint notifikasi pembaruan
- [docs/RELEASE-ANDROID.md](./docs/RELEASE-ANDROID.md) — menaikkan versi, signing, dan distribusi

## Impor Produk dari Excel

Menambah produk satu per satu tidak praktis kalau daftar harga sudah ada di Excel. Tombol **impor**
(ikon panah ke atas) di kanan judul layar **Produk** membuka alurnya:

1. **Pilih berkas** `.xlsx` atau `.csv` lewat pemilih berkas Android.
2. **Tinjau** — jumlah baris yang siap diimpor, contoh isinya, dan baris yang dilewati beserta
   alasannya (misalnya *Baris 4 · Nama produk kosong*).
3. **Impor** — server yang memutuskan hasilnya: berapa dibuat, berapa diperbarui, dan baris mana
   yang dilewati karena produknya sudah ada.

Berkasnya dibaca **di dalam aplikasi** (tidak diunggah ke server, dan server tidak butuh pustaka
spreadsheet). Kolom dikenali dari **nama judulnya**, jadi urutannya bebas dan huruf besar/kecil
tidak masalah:

| Kolom | Wajib | Keterangan |
|---|---|---|
| **Nama** | ya | Nama produk (maks. 255 karakter) |
| **Harga** | ya | `3000`, `5.000`, `Rp 2.500` — semuanya dibaca. Pemisah diikuti dua angka = desimal (`12.500,50` → Rp 12.501) |
| **SKU** | tidak | Kosong → dibuat otomatis (`PRD-000123`). Angka dari Excel tetap utuh |
| **Satuan** | tidak | Default `pcs` |
| **Kategori** | tidak | Dicocokkan tanpa peduli huruf besar/kecil; yang belum ada ikut dibuat |
| **Catatan** | tidak | Kolom `notes` |

Aturan pencocokan produk yang sudah ada (satu baris = satu produk):

- Baris **punya SKU** → dicocokkan lewat SKU. SKU yang sama untuk pengguna lain tidak berpengaruh.
- Baris **tanpa SKU** → dicocokkan lewat nama (tanpa peduli huruf besar/kecil), jadi mengimpor
  ulang daftar yang sama memperbarui harga, bukan menggandakan produk.
- Tanpa centang **Perbarui produk yang sudah ada**, baris yang sudah ada hanya dilewati dan
  dilaporkan — harga lamanya tidak berubah.
- Nama yang hanya berbeda huruf besar/kecil tidak menimpa ejaan yang sudah ada di katalog.
- Baris kosong di ujung berkas diabaikan; baris ganda di dalam satu berkas dilaporkan sekali.
- Maksimal 500 baris per berkas, dan semuanya masuk dalam **satu transaksi** — satu baris rusak
  tidak membatalkan sisanya, tetapi juga tidak ada impor separuh jalan.

Impor butuh koneksi internet (harga dan kode diperiksa server), jadi tombolnya menunggu sampai
perangkat online.

## Layar & Navigasi

Alurnya: **Splash → Login → 4 tab utama**, dengan lima halaman yang dibuka penuh (tab bar
tersembunyi): **Cek Harga**, **Pembayaran**, **Preview Struk**, **Kelola Kategori**, dan
**Notifikasi**.

| Layar | Isi |
|---|---|
| **Beranda** | Sapaan + **lonceng Notifikasi** (bertanda titik bila ada kabar belum dibuka), 4 kartu aksi cepat (Cek Harga · Tambah Produk · Kasir · Riwayat), produk terbaru, dan kartu **Akun** (nama · email · **Keluar**) |
| **Notifikasi** | Kabar aplikasi — hari ini kabar versi baru (catatan rilis · ukuran · tanggal terbit) dengan tombol **Perbarui**/**Nanti**; ada keadaan kosong bila belum ada kabar |
| **Cek Harga** | Pencarian nama/SKU (hasilnya muncul sebagai **popup melayang**, viewfinder tidak bergeser), **tombol mikrofon** di kolom pencarian dan **tombol mic bulat besar** di bawah viewfinder (ucapkan nama produk, mis. “susu”), viewfinder dengan **kamera langsung di dalam app** (memindai hanya area bingkai) + **beep & getar** saat terbaca, tombol **Pindai Barcode** (kamera native ML Kit), panel **belum terdaftar** dengan **Pindai ulang**, kartu hasil + **Tambahkan ke Keranjang** |
| **Produk** | Pencarian, chip kategori, pemilih urutan, daftar produk (thumbnail · nama · SKU · harga), modal detail, tombol **+**; di kanan judul ada **impor dari Excel** dan tombol kategori (**Kelola Kategori**) |
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
> dan tombol scan. Kolom **Harga jual** menampilkan titik per ribuan selagi diketik (“20.000”),
> tetapi angka yang dikirim ke server tetap polos (`20000`) — sama seperti kolom **Dibayar** di
> halaman Pembayaran. Foto produk tidak dipakai di versi ini; kolom Catatan disembunyikan dari form
> (kolom `notes` tetap ada di API).

**Keluar** ada di kartu Akun pada Beranda, memakai dialog konfirmasi. Menekan Keluar mengakhiri
sesi di perangkat: token & profil dihapus, cache data server dibersihkan (akun berikutnya tidak
melihat sisa data akun sebelumnya), keranjang dikosongkan, dan perubahan produk yang belum
tersinkron dibuang — jumlahnya diberitahukan lebih dulu di dialog. Server tetap dipanggil
(`POST /auth/logout`) sebagai upaya terbaik; kalau perangkat sedang offline, sesi lokal tetap
berakhir.
## Pencarian Suara (Cek Harga)

Tombol mikrofon ada dua tempat di halaman **Cek Harga**: kecil di dalam kolom pencarian, dan
**bulat besar di tengah bawah viewfinder** — yang besar bisa ditekan tanpa mengarahkan
pandangan. Sekali ketuk, sebutkan nama produknya (“susu”), lalu daftar produk bermunculan
sebagai popup melayang di bawah kolom pencarian, sehingga viewfinder dan tombol pindai tidak
bergeser. Teksnya mengisi kolom pencarian, jadi pencariannya menempuh jalur yang sama dengan
pencarian ketik — daftar dan harganya tetap datang dari server.

- Di Android dipakai pengenal suara bawaan perangkat lewat
  `@capacitor-community/speech-recognition` (bahasa `id-ID`), karena WebView tidak menyediakan
  Web Speech API. Di peramban web — hanya saat mengembangkan — dipakai Web Speech API.
- Izin mikrofon diminta sekali saat pertama dipakai. Kalau ditolak, aplikasi memberi tahu cara
  mengaktifkannya lagi, bukan gagal diam-diam.
- Pengenal suara Google bekerja **online** dan baru ada bila perangkat punya layanan pengenal
  suara (umumnya aplikasi Google). Tanpa itu tombolnya menjelaskan, dan pencarian ketik tetap
  bisa dipakai.
- Kata perintah di awal ucapan dibuang otomatis: “cari susu” dan “berapa harga susu” sama-sama
  mencari **susu**.

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

