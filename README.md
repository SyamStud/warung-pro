# Personal POS & Price Checker

Aplikasi Android untuk mengelola katalog produk, mengecek harga lewat scan barcode, dan mencatat transaksi penjualan sederhana (POS) dengan cetak struk via printer thermal Bluetooth.

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
- **Hardware:** Barcode scanner (kamera), printer thermal Bluetooth (ESC/POS)

## Status

- **Phase 1 — Project Foundation:** selesai.
- **Phase 2 — Product Catalog:** selesai (API + layar Produk).
- **Phase 3 — Price Checker:** selesai (layar Cek Harga, lookup barcode, alur tidak ditemukan, integrasi scanner ke form produk).
- **Phase 4 — Cloud Sync:** selesai (status koneksi, banner offline, refetch saat pulih, pull-to-refresh, invalidation, isolasi data terverifikasi).
- **Phase 4.5 — Antrean Offline (durable queue):** selesai (perubahan produk saat offline disimpan permanen di perangkat dan disinkron otomatis saat online kembali).
- Berikutnya: Phase 5 — POS.

Lihat §13 di [PLAN.md](./PLAN.md) untuk roadmap lengkap.

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

> Ditunda (di luar MVP): merge/penanganan konflik multi-perangkat untuk perubahan yang sama.


> Pemindaian kamera hanya aktif di aplikasi Android (`npx cap run android`).
> Di preview browser, tombol pindai menampilkan pesan agar pengguna memakai input manual.

## Prasyarat

- Node.js >= 20, npm/pnpm
- PHP >= 8.5, Composer
- PostgreSQL >= 15 (produksi; lokal bisa pakai SQLite)
- Android Studio + JDK 17 (untuk build Android)

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
| GET | `/products` | Daftar & pencarian produk |
| POST | `/products` | Membuat produk (SKU otomatis bila kosong; mendukung header `Idempotency-Key`) |
| GET | `/products/{id}` | Detail produk |
| PATCH | `/products/{id}` | Update produk |
| DELETE | `/products/{id}` | Arsipkan produk |
| GET | `/products/lookup?barcode=` | Lookup barcode |
| GET | `/categories` | Daftar kategori |
| POST | `/categories` | Membuat kategori |

Semua error memakai envelope `{ "error": { "code", "message", "details?" } }`.

