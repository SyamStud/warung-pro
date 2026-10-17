# Personal POS & Price Checker — MVP Plan (v2)

> **Status:** Draft untuk dieksekusi
> **Fokus MVP:** Price Checker + Katalog → POS + Cetak Struk
> **Prinsip:** server-authoritative, online-first, tanpa manajemen stok

---

## 1. Ringkasan Produk

**Personal POS & Price Checker** adalah aplikasi Android untuk:

1. Mengelola katalog produk dan harga.
2. Mengecek harga lewat **scan barcode** atau **pencarian**.
3. Mencatat transaksi penjualan sederhana (POS).
4. Mencetak struk via **printer thermal** (Bluetooth SPP, USB OTG, atau WiFi/LAN).

Backend/cloud menjadi **sumber data utama** agar katalog dan riwayat transaksi konsisten di beberapa perangkat.

### 1.1 Tujuan MVP

| # | Tujuan | Indikator keberhasilan |
|---|---|---|
| G1 | Pencatatan & pembaruan harga cepat | Tambah/edit produk < 30 detik |
| G2 | Pengecekan harga cepat via kamera | Scan → harga tampil < 2 detik (jaringan normal) |
| G3 | Katalog dapat dicari (nama/SKU) | Semua mode pencarian mengembalikan hasil benar |
| G4 | Kasir sederhana + cetak struk | Transaksi tersimpan & struk tercetak |
| G5 | Data konsisten lintas perangkat | Perubahan produk terlihat di perangkat lain setelah refresh |

### 1.2 Prinsip Pengembangan

- **Price Checker dulu, POS kemudian.** Jangan menyentuh fitur retail kompleks sebelum inti stabil.
- **Server-authoritative.** Harga, total, dan perhitungan lain dihitung backend — aplikasi tidak dipercaya.
- **Tanpa manajemen stok.** Tidak ada tabel/flow stok, mutasi, atau opname di MVP.
- **SKU dan barcode adalah satu hal yang sama.** Produk hanya punya satu kolom kode (`sku`): boleh digenerate otomatis, diketik manual, atau diisi dari hasil scan. Lihat §7.
- **Riwayat bersifat historis.** Perubahan harga tidak mengubah transaksi lama (snapshot).
- **Bertahap.** Tiap phase punya deliverable yang bisa dipakai/diuji sendiri.

### 1.3 Non-Goals (MVP)

Manajemen stok, stock opname, supplier/PO, multi-cabang, payment gateway, pajak/diskon kompleks, marketplace, akuntansi, analitik lanjutan, offline-first dua arah, multi-user role/permission kompleks.

---

## 2. Arsitektur & Technology Stack

### 2.1 Stack

| Lapisan | Teknologi | Catatan |
|---|---|---|
| Platform | Android | Target minimum Android 8 (API 26) |
| Mobile framework | Ionic React | UI + navigasi |
| Bahasa | TypeScript | `strict: true` |
| Native runtime | Capacitor | Akses kamera & Bluetooth |
| Routing | React Router (via Ionic) | 4 tab utama |
| Server state | TanStack Query | Cache, retry, invalidation |
| Form | React Hook Form | |
| Validasi form | Zod | Skema dipakai bersama di client |
| Backend | Laravel REST API | v11+ |
| Database | PostgreSQL | v15+ |
| Auth | Laravel Sanctum | Token per perangkat |
| Barcode scanner | Plugin barcode Capacitor | MLKit/ZXing-compatible |
| Printer | Bluetooth SPP / USB OTG / WiFi TCP + ESC/POS | Abstraksi `PrinterService` |
| Local cache | SQLite (opsional) | **Ditunda** sampai pasca-MVP |
| Hosting | VPS + HTTPS | Sertifikat valid (Let's Encrypt) |
| VCS | Git | Trunk-based + PR |

### 2.2 Diagram Arsitektur

```text
┌──────────────────────────── Android App ────────────────────────────┐
│  Ionic React + TypeScript                                           │
│  ├── React Router  ── 4 tab: Price Checker | Products | POS | History│
│  ├── TanStack Query ── cache & sinkronisasi server state            │
│  ├── Barcode Scanner (Capacitor)                                    │
│  ├── Printer Service (ESC/POS over Bluetooth SPP / USB / TCP)       │
│  └── Secure Storage (token)                                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                 │ HTTPS / JSON
                                 ▼
┌──────────────────────────── Laravel REST API ────────────────────────┐
│  Auth (Sanctum) · Products · Categories · Product Lookup (SKU)       │
│  SKU Generator · Transactions (idempotent) · Receipt Data           │
└───────────────────────────────┬─────────────────────────────────────┘
                                 ▼
┌──────────────────────────── PostgreSQL ─────────────────────────────┐
│  users · categories · products · transactions · transaction_items   │
│  (unique constraints + indexes = sumber kebenaran integritas data)  │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.3 Tanggung Jawab Komponen

- **Ionic React:** UI, navigasi, pencarian, katalog, keranjang, riwayat.
- **Capacitor:** jembatan ke kamera, penyimpanan aman, dan Bluetooth.
- **Laravel:** business logic, autentikasi, validasi, generator SKU, pemrosesan transaksi, idempotensi.
- **PostgreSQL:** penyimpanan utama + penjaga integritas (constraint).
- **Printer Service:** abstraksi komunikasi printer agar POS tidak terikat satu library.

---

## 3. Scope MVP

Legenda: **P0** = wajib untuk inti (katalog + price checker), **P1** = POS + cetak struk, **P2** = pasca-MVP.

### A. Authentication (P0)

- [x] Registrasi akun.
- [x] Login & logout (token per perangkat).
- [x] Penyimpanan token aman (Capacitor Secure Storage / Keystore). *Android: AES-GCM dengan kunci di Android Keystore (`@aparajita/capacitor-secure-storage`); web memakai `localStorage` (hanya untuk preview dev). Token lama di Preferences dimigrasikan otomatis.*
- [x] Ambil profil pengguna (`GET /me`).
- [x] Otorisasi berbasis kepemilikan data (semua query ter-scope `user_id`).
- [x] Satu akun dipakai dari beberapa perangkat.

### B. Product Management (P0)

- [x] Daftar produk (pagination).
- [x] Tambah / lihat detail / edit produk.
- [x] Arsipkan produk (soft delete).
- [x] Pencarian by **nama** dan **SKU**.
- [x] Input SKU via kamera (scan) atau manual.
- [x] Generate SKU otomatis (backend, `GET /products/next-sku`).
- [x] Validasi SKU duplikat (unik antar produk aktif; boleh dipakai ulang setelah diarsipkan).
- [x] Kategori produk (sederhana: list + create).

### C. Price Checker (P0)

- [x] Scan barcode via kamera.
- [x] Tampilkan produk + harga setelah kode ditemukan.
- [x] Tampilkan harga jual dan SKU dengan jelas.
- [x] Pencarian manual (nama/SKU).
- [x] Status "kode tidak ditemukan" + aksi tambah produk (SKU terisi otomatis).
- [x] Penanganan izin kamera & kegagalan scanner.

### D. Cloud Sync (P0)

- [x] Data produk tersimpan di backend.
- [x] Ambil katalog dari API.
- [x] Perubahan produk terlihat antarperangkat (refresh/invalidation).
- [x] Cache TanStack Query.
- [x] Penanganan kegagalan koneksi (error eksplisit, bukan data palsu).
- [x] Indikator status koneksi & penyimpanan.
- [x] Pagination katalog & riwayat.

### E. Point of Sale (P1)

- [x] Tambah produk ke keranjang via scan/pencarian.
- [x] Ubah kuantitas & hapus item.
- [x] Hitung subtotal & total.
- [x] Input pembayaran & hitung kembalian.
- [x] Simpan transaksi ke backend (atomik).
- [x] Ringkasan transaksi.
- [x] Riwayat & detail transaksi.
- [x] Cegah transaksi ganda (idempotency key).

### F. Thermal Receipt Printing (P1)

- [x] Pilih printer thermal Bluetooth.
- [x] Simpan printer default.
- [x] Test print.
- [x] Dukungan ESC/POS.
- [x] Format 58 mm / 80 mm.
- [x] Cetak info toko & transaksi.
- [x] Cetak item, kuantitas, harga, total.
- [x] Cetak pembayaran & kembalian.
- [x] Tangani kegagalan koneksi printer.
- [x] Cetak ulang dari riwayat.

> **Catatan implementasi (Phase 6):** transport yang didukung **Bluetooth SPP, USB (OTG), dan WiFi/LAN (TCP 9100)**
> lewat plugin `@devlas/capacitor-thermal-printer` (raw ESC/POS bytes). Struk dibuat oleh encoder
> lokal (`src/lib/receipt`) sehingga bisa diuji tanpa perangkat keras. **Verifikasi pada printer fisik
> masih perlu dilakukan** — lihat §10.5.

### G. Pasca-MVP (P2) — hanya setelah MVP stabil

SQLite cache persisten · pencarian offline · antrean transaksi offline · retry/sync otomatis · resolusi konflik · backup/restore terjadwal.

**Sudah dikerjakan:** resolusi konflik multi-perangkat (§9.2).
**Belum:** SQLite cache katalog persisten, pencarian offline penuh, antrean transaksi offline, backup/restore terjadwal.

---

## 4. Layar Aplikasi

Alur: **Splash → Login → 4 tab utama → halaman tambahan (pushed, tanpa tab bar)**.

Tab utama: **Beranda · Produk · POS · Riwayat**. Halaman yang dibuka dari tab (Cek Harga, Pembayaran, Preview Struk) tampil penuh sebagai halaman yang di-push sehingga tab bar tersembunyi.

Sistem desain: biru `#2563EB`, latar `#F4F6FA`, kartu putih bersudut bulat, tombol utama biru selebar penuh, bar pencarian berbentuk pil, chip untuk filter, dan badge untuk status.

### 4.1 Splash

Layar pembuka bertema biru dengan logo warung (SVG inline) dan tombol **Mulai** → Login. Ditampilkan saat belum ada sesi.

### 4.2 Login

Email + kata sandi, tombol tampilkan/sembunyikan sandi, tombol **Masuk** biru. Tautan **Lupa password?** dan **Daftar** ditampilkan sebagai informasi (belum ada endpoint reset/registrasi di MVP).

### 4.3 Beranda

Sapaan pengguna, **4 kartu aksi cepat** (Cek Harga · Tambah Produk · Kasir · Riwayat), dan daftar **Produk terbaru** dengan tautan *Lihat semua*.

Saat server punya rilis aplikasi yang lebih baru, Beranda juga menampilkan strip **Versi x.y.z tersedia** dengan tombol **Perbarui** dan **Nanti** (lihat §16).

### 4.4 Cek Harga (pushed)

| Elemen | Perilaku |
|---|---|
| View finder | Kamera **langsung di dalam app** (pratinjau + pindai otomatis); tombol **Pindai Barcode** tetap membuka UI kamera native ML Kit sebagai cara kedua |
| Search bar | Cari nama/SKU, debounce 300 ms |
| Hasil pencarian | Daftar produk (nama, SKU, harga) |
| Kartu hasil | Nama, harga besar, SKU, satuan, tombol **Tambahkan ke Keranjang** |
| State "tidak ditemukan" | Pesan jelas + tombol **Tambah produk** (SKU terisi otomatis) |
| Error state | Izin kamera ditolak / scanner gagal / jaringan putus |

> Dua cara memindai: (1) pratinjau kamera langsung di dalam app — WebView mengambil
> gambar lewat `getUserMedia`, lalu frame didekode di app; dan (2) tombol **Pindai Barcode**
> yang membuka UI native `@capacitor-mlkit/barcode-scanning`. WebView Android tidak
> menyediakan `BarcodeDetector`, jadi dekode di app memakai zxing (`@zxing/library`, dimuat
> on-demand agar tidak membebani bundel). Keduanya berbagi alur izin kamera dan `lookup`
> yang sama; setiap kegagalan pratinjau berakhir pada pesan + tombol ML Kit, bukan jalan buntu.
> Uji pada kamera perangkat fisik masih tertunda (§10.5).
>
> Umpan balik saat barcode terbaca: **suara beep** dua nada (1568 → 2093 Hz, dibuat
> lewat Web Audio API — tanpa file audio, jadi tidak bisa diblokir kebijakan autoplay
> media) dan getaran singkat dari `@capacitor/haptics`. Tombol ML Kit memakai beep
> bawaan UI native-nya sendiri.
>
> **Akurasi & kecepatan dekode di app** (§4.4, diuji lewat video barcode asli):
> - Hanya area **bingkai** yang didekode — persegi bingkai dipetakan balik ke piksel video
>   (video ditampilkan `object-fit: cover`, jadi pemetaannya memperhitungkan cropping).
>   Barang di luar bingkai tidak ikut dibaca, jadi latar belakang tidak memicu salah baca.
> - Format dibatasi ke 1D retail yang **ber-checksum** (EAN-13/8, UPC-A/E, Code 128).
>   CODE-39/ITF (sumber utama salah baca) dan detektor 2D yang mahal dimatikan di app;
>   kode 2D tetap bisa lewat tombol ML Kit.
> - Satu bacaan **tidak langsung dipercaya**: nilai yang sama harus terbaca dua kali
>   berturut-turut dalam 1,2 detik. Beep dan harga baru muncul setelah itu.
> - Setiap percobaan hanya memproses ±(0,3–0,9) MP, ~9 percobaan/detik, dan kamera diminta
>   **fokus kontinu**; tombol lampu muncul otomatis bila perangkat punya torch.
>
> **Kode tak dikenal tidak lagi mematikan pemindai.** Dulu kegagalan `lookup` memunculkan
> modal dan latch pemindai tetap tertutup, sehingga pengguna harus keluar-masuk halaman
> untuk memindai lagi. Sekarang hasilnya muncul sebagai panel di halaman (SKU apa adanya,
> tombol **Pindai ulang** dan **Tambah produk baru**) sementara kamera tetap berjalan;
> pencarian kode berikutnya langsung dilaporkan tanpa me-restart kamera.

### 4.5 Katalog Produk

Bar pencarian pil, chip kategori (+ tambah kategori), pemilih urutan (Terbaru · Nama A-Z · Harga terendah · Harga tertinggi), daftar produk (thumbnail inisial, nama, SKU, harga biru), tombol **+** untuk menambah produk, dan modal detail (edit/arsip).

Form tambah/edit punya **satu kolom “SKU / Barcode”** dengan tombol **generate** (backend) dan tombol **scan**. Foto produk tidak diperlukan.

### 4.6 POS

Pencarian & scan, daftar keranjang dengan kontrol kuantitas, ringkasan subtotal, dan tombol **Lanjut ke Pembayaran**. Keranjang disimpan di provider bersama (memori), sehingga bisa diisi dari Cek Harga.

### 4.7 Pembayaran (pushed)

Ringkasan pesanan ringkas (nama produk, jumlah × harga, total baris, lalu total), pemilih **metode pembayaran (Tunai / Non Tunai)**, input **dibayar** dengan pemisah ribuan dan pintasan nominal, serta tampilan **kembalian**. Untuk Non Tunai, nominal dianggap pas (tanpa kembalian). Tombol **Bayar** menyimpan transaksi ke server (idempotent) lalu membuka Preview Struk.

### 4.8 Preview Struk (pushed)

Kartu struk bergaya kertas (nama toko, alamat, tanggal, nomor, item, subtotal, diskon, total, baris metode pembayaran, kembalian, footer), tombol **Cetak Struk**, dan tampilan sekunder **teks printer** (monospace) sesuai lebar kertas.

### 4.9 Riwayat Transaksi

Pencarian nomor transaksi, chip metode pembayaran (Semua/Tunai/Non Tunai), daftar transaksi dengan badge status & metode, modal detail item + pembayaran, dan tombol cetak ulang.

---

## 5. Desain Database (PostgreSQL)

### 5.1 `users`

| Field | Type | Keterangan |
|---|---|---|
| id | BIGINT PK | |
| name | VARCHAR | Nama pengguna |
| email | VARCHAR UNIQUE | Email |
| password | VARCHAR | Hash |
| created_at / updated_at | TIMESTAMP | |

### 5.2 `categories`

| Field | Type | Keterangan |
|---|---|---|
| id | BIGINT PK | |
| user_id | BIGINT FK → users | Pemilik |
| name | VARCHAR | Nama kategori |
| created_at / updated_at | TIMESTAMP | |

Constraint: `UNIQUE (user_id, name)`.

### 5.3 `products`

| Field | Type | Keterangan |
|---|---|---|
| id | BIGINT PK | |
| user_id | BIGINT FK → users | Pemilik |
| category_id | BIGINT FK → categories, NULL | Kategori |
| name | VARCHAR | Nama produk |
| sku | VARCHAR | Kode produk (SKU = barcode) |
| unit | VARCHAR | Satuan (pcs, kg, dst.) |
| selling_price | BIGINT | Harga jual (rupiah, integer) |
| notes | TEXT, NULL | Catatan |
| is_active | BOOLEAN | Status produk |
| idempotency_key | VARCHAR, NULL | Kunci anti-duplikat `POST /products` |
| version | BIGINT | Revisi baris untuk deteksi konflik (mulai 1) |
| created_at / updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP, NULL | Soft delete |

**Ketentuan & constraint:**

- `sku` wajib (diisi pengguna atau digenerate backend).
- **Unique `(user_id, sku)` hanya antar produk aktif** (partial unique index `WHERE deleted_at IS NULL`), sehingga kode produk yang sudah diarsipkan boleh dipakai ulang.
- `selling_price >= 0` (check constraint).
- `version` naik 1 setiap update dan dipakai untuk optimistic concurrency (§9.2).
- Produk yang sudah dipakai transaksi **diarsipkan**, bukan dihapus permanen.
- Index: `name`, `sku`.

Contoh partial unique index:

```sql
CREATE UNIQUE INDEX products_user_id_sku_unique
  ON products (user_id, sku)
  WHERE deleted_at IS NULL;
```

> **Migrasi `merge_barcode_into_sku`:** kolom `barcode` lama dihapus. Untuk data yang sudah ada, nilai `barcode` **menang** menjadi `sku` baru bila terisi; kalau tidak, `sku` lama dipertahankan.

### 5.4 `transactions`

| Field | Type | Keterangan |
|---|---|---|
| id | BIGINT PK | |
| user_id | BIGINT FK → users | Pemilik |
| transaction_number | VARCHAR UNIQUE | Nomor transaksi |
| status | VARCHAR | `paid` / `void` (lihat §8) |
| subtotal | BIGINT | Total sebelum penyesuaian |
| discount_amount | BIGINT | Diskon, default 0 |
| total | BIGINT | Total bayar |
| paid_amount | BIGINT | Nominal dibayar |
| change_amount | BIGINT | Kembalian |
| payment_method | VARCHAR(20) | `cash` / `non_cash` (default `cash`) |
| idempotency_key | VARCHAR, NULL | Kunci anti-duplikat |
| created_at / updated_at | TIMESTAMP | |

Constraint: `UNIQUE (user_id, idempotency_key)` untuk key non-NULL. Index `(user_id, created_at DESC)`. PostgreSQL: `CHECK (payment_method IN ('cash', 'non_cash'))`.

### 5.5 `transaction_items`

| Field | Type | Keterangan |
|---|---|---|
| id | BIGINT PK | |
| transaction_id | BIGINT FK → transactions (cascade) | Relasi |
| product_id | BIGINT FK → products, NULL | Referensi (boleh null bila produk terhapus) |
| product_name | VARCHAR | Snapshot nama |
| sku | VARCHAR, NULL | Snapshot SKU (kode produk) |
| unit_price | BIGINT | Harga saat transaksi |
| quantity | INTEGER | Kuantitas (integer > 0) |
| line_total | BIGINT | `unit_price * quantity` |

**Ketentuan:**

- Nama/harga disimpan sebagai **snapshot**.
- `line_total` & `total` dihitung **backend**.
- Header + item disimpan dalam **satu database transaction**.
- Check: `quantity > 0`, `unit_price >= 0`, `line_total >= 0`.

### 5.6 Relasi

```text
users 1─┬─* categories
        ├─* products ──0..1─ categories
        └─* transactions 1─* transaction_items ──0..1─ products
```

---

## 6. Desain REST API

Base URL: `/api/v1`. Semua response JSON. Semua endpoint privat butuh `Authorization: Bearer <token>`.

### 6.1 Authentication

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/auth/register` | Registrasi |
| POST | `/auth/login` | Login (buat token) |
| POST | `/auth/logout` | Cabut token aktif |
| GET | `/me` | Profil pengguna |

### 6.2 Products

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/products` | Daftar & pencarian (`search`, `category_id`, `sort`, `page`, `per_page`) |
| POST | `/products` | Buat produk |
| GET | `/products/next-sku` | Saran SKU berikutnya (belum dipesan sampai disimpan) |
| GET | `/products/{id}` | Detail produk |
| PATCH | `/products/{id}` | Update produk |
| DELETE | `/products/{id}` | Arsipkan (soft delete) |
| GET | `/products/lookup?sku={code}` | Lookup produk berdasarkan SKU (= kode hasil scan) |

Nilai `sort`: `name`, `price_asc`, `price_desc` (selain itu → urut `id` terbaru).

### 6.3 Categories

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/categories` | Daftar kategori |
| POST | `/categories` | Buat kategori |
| PATCH | `/categories/{id}` | Ubah nama kategori |
| DELETE | `/categories/{id}` | Hapus kategori (produk jadi tanpa kategori) |

### 6.4 Transactions

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/transactions` | Simpan transaksi (idempotent) |
| GET | `/transactions` | Daftar transaksi (`search`, `payment_method`, pagination) |
| GET | `/transactions/{id}` | Detail transaksi |
| GET | `/transactions/{id}/receipt` | Data untuk cetak struk |

### 6.5 Contoh Kontrak

**Create product**

```http
POST /api/v1/products
Content-Type: application/json

{
  "name": "Air Mineral 600ml",
  "sku": null,                 // null/kosong → backend generate otomatis (PRD-000042)
  "unit": "pcs",
  "selling_price": 4000,
  "category_id": 2,
  "notes": null
}
```

```json
201 Created
{
  "data": {
    "id": 42,
    "name": "Air Mineral 600ml",
    "sku": "PRD-000042",
    "unit": "pcs",
    "selling_price": 4000,
    "category_id": 2,
    "is_active": true
  }
}
```

**Lookup hasil scan**

```http
GET /api/v1/products/lookup?sku=8991234567890
```

`200 OK` bila ditemukan; `404 NOT_FOUND` dengan pesan `Produk dengan SKU tersebut tidak ditemukan.` bila belum terdaftar.

**Create transaction (idempotent)**

```http
POST /api/v1/transactions
Idempotency-Key: 8f2c1e10-...-a31
Content-Type: application/json

{
  "items": [
    { "product_id": 42, "quantity": 2 },
    { "product_id": 51, "quantity": 1 }
  ],
  "discount_amount": 0,
  "paid_amount": 20000
}
```

```json
201 Created
{
  "data": {
    "id": 9001,
    "transaction_number": "TRX-20261016-0001",
    "subtotal": 22000,
    "discount_amount": 0,
    "total": 22000,
    "paid_amount": 20000,   // ⚠ contoh: jika < total → 422 VALIDATION_ERROR
    "change_amount": 0,
    "status": "paid",
    "items": [
      { "product_name": "Air Mineral 600ml", "unit_price": 4000, "quantity": 2, "line_total": 8000 }
    ]
  }
}
```

**Concurrent edit of a product (optimistic concurrency)**

```http
PATCH /api/v1/products/42
Content-Type: application/json

{
  "selling_price": 9000,
  "version": 3
}
```

```json
409 Conflict
{
  "error": {
    "code": "CONFLICT",
    "message": "Produk ini sudah diubah di perangkat lain.",
    "details": {
      "current": {
        "id": 42,
        "name": "Air Mineral 600ml",
        "selling_price": 4500,
        "version": 5
      }
    }
  }
}
```

`version` yang dikirim adalah revisi yang menjadi dasar edit. Bila server sudah
lebih baru dan nilainya berbeda, perubahan **tidak** ditimpa; client meminta
pengguna memilih. Kirim `"force": true` untuk menimpa dengan sengaja (§9.2).

**Format error konsisten**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Pembayaran kurang dari total.",
    "details": { "paid_amount": ["Pembayaran kurang dari total 22000."] }
  }
}
```

Kode error: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT` (duplikat SKU **atau** versi baris yang sudah bergerak), `RATE_LIMITED`, `SERVER_ERROR`.

### 6.6 API Rules

- Semua endpoint privat butuh autentikasi; pengguna hanya akses data miliknya.
- Validasi request di backend (Form Request + Zod-equivalent rules).
- SKU & transaction_number dibuat **aman terhadap request bersamaan** (§7).
- Total transaksi dihitung dari harga produk valid di DB — bukan dari client.
- Idempotency key untuk operasi pembayaran (header `Idempotency-Key`).
- Format error konsisten.
- Rate limiting pada endpoint auth.

---

## 7. Aturan SKU (SKU = Barcode)

SKU dan barcode diperlakukan sebagai **satu kolom kode yang sama** (`products.sku`). Tidak ada lagi kolom `barcode` terpisah.

Konsekuensinya:

- Kode hasil scan barcode langsung menjadi SKU produk.
- Lookup hasil scan memakai `GET /products/lookup?sku=...`.
- Pencarian katalog mencocokkan **nama** dan **sku**.
- SKU boleh **dipakai ulang** setelah produknya diarsipkan (unique hanya antar produk aktif).

### Cara 1 — Scan

Scan → `GET /products/lookup?sku=...`:

- **Ditemukan** → tampilkan produk + harga.
- **Tidak ditemukan** → tawarkan tambah produk; kolom SKU di form terisi otomatis dengan kode hasil scan.

### Cara 2 — Auto-Generated SKU

Format: `PRD-{6 digit urut}` → `PRD-000042`.

- `GET /products/next-sku` mengembalikan **saran** berikutnya untuk ditampilkan di form; nilai belum dipesan sampai produk disimpan.
- Penyimpanan tetap memakai generator yang aman terhadap request bersamaan.

**Jangan** basis jumlah produk (race condition). Gunakan salah satu:

- **PostgreSQL sequence** khusus + `lpad`, atau
- tabel `counters` dengan `SELECT ... FOR UPDATE` di dalam transaksi, atau
- ULID/NanoID **dengan prefix** bila human-readability tidak diprioritaskan.

Retry otomatis bila unique constraint gagal karena race.

### Cara 3 — Manual Input

Pengguna mengetik kode sendiri. Backend memvalidasi duplikasi antar produk aktif sebelum menyimpan dan mengembalikan `422 VALIDATION_ERROR` pada field `sku` bila bentrok. SKU milik produk yang sudah diarsipkan tidak menghalangi.

### Nomor Transaksi

Format: `TRX-{YYYYMMDD}-{4 digit urut per hari}`. Digenerate backend dengan mekanisme aman (§6.6), unique constraint sebagai pengaman terakhir.

---

## 8. Business Rules POS

**Status transaksi** dipisahkan dari **status cetak** (lihat §10).

Status transaksi: `paid` (lunas), `void` (dibatalkan — pasca-MVP jika dibutuhkan).

1. Produk harus **aktif** (`is_active = true`, `deleted_at IS NULL`) untuk masuk transaksi baru.
2. `quantity` bilangan bulat **> 0**.
3. Harga produk diambil dari **backend**, bukan dari app.
4. `subtotal`, `total`, `change_amount` dihitung **backend**.
5. Untuk transaksi lunas, `paid_amount >= total`.
6. Header + item disimpan **atomik** (satu DB transaction).
7. Request berulang dengan idempotency key sama → kembalikan transaksi yang sudah ada (jangan buat baru).
8. Riwayat historis: perubahan harga produk tidak mengubah transaksi lama.
9. Status cetak dikelola terpisah dari status transaksi.
10. Kegagalan cetak **tidak** membatalkan transaksi yang sudah tersimpan.
11. `payment_method` hanya boleh `cash` (Tunai) atau `non_cash` (Non Tunai); default `cash`.
12. Untuk Non Tunai, `paid_amount` dianggap sebesar `total` sehingga `change_amount = 0`.
13. Struk menampilkan baris nominal dibayar dengan label metode: `Tunai` / `Non Tunai`.

**Formula:** `subtotal = Σ line_total`; `total = subtotal − discount_amount`; `change = paid_amount − total`.

---

## 9. Strategi Cloud & Multi-Device

Pendekatan **server-authoritative**, **online-first** untuk MVP.

- Katalog diambil via API; perubahan disimpan di server.
- TanStack Query untuk cache & invalidation; refetch saat app kembali fokus.
- Token disimpan di secure storage.
- Kegagalan koneksi ditampilkan eksplisit; request gagal **tidak** boleh tampil sebagai "tersimpan".
- Pagination untuk katalog & riwayat.

### 9.1 Antrean Offline (Write Queue) — *diterapkan di Phase 4.5*

Meski pendekatan utama online-first, perubahan katalog yang gagal terkirim tetap aman:

- Saat offline (atau request gagal jaringan), perubahan disimpan **permanen** di *outbox* perangkat: SQLite di Android (`@capacitor-community/sqlite`), `localStorage` di web/preview.
- Antrean **disinkron otomatis** saat online kembali atau app dibuka, berurutan.
- Retry anti-duplikat via header `Idempotency-Key` pada `POST /products`.
- Perubahan tertunda tampil optimistis di UI (badge **Menunggu**) dan indikator jumlah di header.
- Item yang ditolak server (4xx) ditandai **gagal** — dapat dicoba ulang atau dibuang; tidak di-retry buta.
- **Transaksi POS tidak diantrekan offline**: checkout butuh koneksi karena harga/total dihitung server (menghindari selisih bila harga berubah saat offline).

**Masih Pasca-MVP (P2):** SQLite cache katalog persisten, pencarian offline penuh, antrean transaksi offline, backup/restore.

### 9.2 Resolusi Konflik Multi-Perangkat (P2) — *diterapkan di Phase 8*

Dua perangkat dapat mengedit produk yang sama. Tanpa penjagaan, device B menimpa
perubahan device A tanpa jejak (*lost update*). MVP memakai **optimistic concurrency**:

- Setiap baris `products` punya kolom `version` (mulai 1, naik 1 setiap update).
- Client **wajib** mengirim `version` yang menjadi dasar edit (`PATCH /products/{id}`).
  Bila versi server sudah lebih baru **dan** nilainya berbeda → `409 CONFLICT`
  dengan baris server terkini di `error.details.current`.
- Bila versi beda tetapi **nilai yang diminta sudah sama** dengan server, request
  dianggap berhasil (`200`) tanpa menaikkan versi. Ini membuat **retry karena
  response hilang** tidak salah dilaporkan sebagai konflik.
- Client dapat memaksa menang dengan `force: true` (dipakai saat pengguna memilih
  "Simpan milik saya").
- Tanpa `version` (mis. tooling lama), update tetap berlaku seperti sebelumnya.

Alur di aplikasi:

1. Simpan saat online dengan versi basi → `409` → perubahan **diparkir** di outbox
   dengan status `conflict` (tetap durable, ikut selamat dari restart).
2. Ikon sinkronisasi di header memerah; tombol **Tinjau bentrok** membuka
   perbandingan per-field (nilai server vs nilai saya).
3. Pengguna memilih **Pakai versi server** (buang edit lokal, refetch) atau
   **Simpan milik saya** (kirim ulang dengan `force: true`).
4. Item `conflict` **tidak** di-retry otomatis sampai pengguna memutuskan, agar
   perubahan perangkat lain tidak hilang diam-diam.

> Mengganti keputusan desain lain? Tidak. Snapshot transaksi & harga
> server-authoritative (§8) tetap utuh: aturan ini hanya untuk katalog.

---

## 10. Integrasi Printer Thermal

### 10.1 Requirements

- Printer thermal kompatibel Android: **Bluetooth SPP**, **USB (OTG)**, atau **WiFi/LAN (TCP 9100)**.
- Dukungan ESC/POS bila printer memakai protokol tersebut.
- Format 58 mm / 80 mm sesuai perangkat.

### 10.2 Printer Service (implementasi)

Abstraksi yang dipakai di `mobile/src/services/printer.ts`:

```typescript
type PrinterTransportKind = "bluetooth" | "usb" | "tcp";

interface SavedPrinter {
  transport: PrinterTransportKind;
  label: string;
  address?: string;   // Bluetooth MAC
  vendorId?: number;  // USB
  productId?: number; // USB
  host?: string;      // TCP
  port?: number;      // TCP (default 9100)
}

interface PrinterSettings {
  paperWidth: "58" | "80";
  storeName: string;
  storeAddress: string;
  footer: string;
  printer: SavedPrinter | null;
}

function listPrintDevices(transport: "usb" | "bluetooth"): Promise<PrinterDevice[]>;
function printTransaction(t: Transaction, s: PrinterSettings): Promise<void>;
function testPrint(s: PrinterSettings): Promise<void>;
function previewReceipt(t: Transaction, s: PrinterSettings): string;
```

- Transport native: plugin `@devlas/capacitor-thermal-printer` — stateless `print()` (connect → write → close),
  bytes dikirim sebagai base64 agar tidak rusak saat melewati bridge.
- Encoder struk sendiri (`mobile/src/lib/receipt`): model layout dipisah dari renderer, sehingga
  lebar 58 mm (32 kolom) dan 80 mm (48 kolom) bisa diuji tanpa printer. Renderer: ESC/POS bytes
  (printer) dan teks biasa (pratinjau di web).
- Di web/browser pencetakan tidak tersedia; aplikasi menampilkan **pratinjau struk** sebagai gantinya.

### 10.3 Konten Struk

Nama toko · nomor transaksi · tanggal & waktu · nama produk · kuantitas · harga satuan · total per item · subtotal · diskon · total · **nominal dibayar dengan label metode (Tunai / Non Tunai)** · kembalian (hanya tunai) · pesan penutup opsional.

### 10.4 Failure Handling

- Transaksi tetap tersimpan walau printer gagal.
- Status cetak terpisah dari status transaksi.
- Pengguna dapat mencoba cetak ulang.
- Cetak ulang **tidak** membuat transaksi baru.
- Sediakan test print sebelum dipakai untuk transaksi.

### 10.5 Verifikasi di Perangkat Fisik (belum dilakukan)

Encoder struk sudah diuji otomatis (lebar 58/80 mm, pembungkusan baris, perataan harga).
Build APK **debug** sudah diverifikasi di lingkungan pengembangan (JDK 21 + Android SDK 36):
`./gradlew assembleDebug` menghasilkan `app-debug.apk` ±38 MB yang memuat aset web di
`assets/public/`. Yang **belum** bisa diverifikasi (tidak ada printer/perangkat fisik):

1. Memasang APK ke perangkat, dan `./gradlew assembleRelease` dengan keystore asli
   (lihat [docs/RELEASE-ANDROID.md](../docs/RELEASE-ANDROID.md) §4).
2. Pasangkan printer di pengaturan sistem Android (Bluetooth) atau sambungkan via OTG (USB).
3. Buka **Riwayat → ikon printer** (atau ikon printer di tab Kasir), pilih jenis koneksi, "Cari perangkat",
   pilih printer, atur lebar kertas, lalu **Cetak uji**.
4. Cetak struk nyata dari detail transaksi dan dari dialog sukses checkout (tombol "Cetak struk").

Dua kendala build native pertama sudah teratasi dan terdokumentasi (tetap relevan bila versi
dinaikkan): Capacitor 8 menargetkan Java 21 (JDK 17 gagal di `:capacitor-android`), dan
`usb-serial-for-android` dari JitPack hanya bisa di-resolve jika `https://jitpack.io` terdaftar
di blok `allprojects { repositories }` pada `mobile/android/build.gradle` — deklarasi repository
di modul plugin tidak diwariskan ke `:app`.

---

## 11. Keamanan & Keandalan

- HTTPS untuk seluruh komunikasi.
- Password di-hash aman (bcrypt/argon2).
- Token dapat dicabut (Sanctum).
- Token disimpan terenkripsi di perangkat: AES-GCM dengan kunci di Android Keystore
  (`@aparajita/capacitor-secure-storage`); nilai yang tidak terbaca (mis. kunci
  Keystore terinvalidasi) dibuang dan pengguna diminta login ulang.
- Otorisasi berbasis pemilik data di setiap query.
- Validasi seluruh input di backend.
- Rate limiting endpoint auth (10/menit) dan API terautentikasi (120/menit per pengguna).
- Tidak menyimpan secret backend di app Android.
- Constraint DB untuk mencegah duplikasi.
- DB transaction untuk penyimpanan transaksi.
- Idempotensi pada operasi pembayaran.
- Backup DB + prosedur restore.
- Jangan catat token/data sensitif ke log.

---

## 12. Strategi Pengujian

### 12.1 Unit Tests

- Perhitungan subtotal, total, kembalian.
- Generator SKU & nomor transaksi (termasuk race).
- Validasi harga & kuantitas.
- Validasi duplikat SKU (termasuk boleh dipakai ulang setelah arsip).
- Format data struk.
- Optimistic concurrency (versi basi, retry tanpa konflik, `force`).
- Perbandingan konflik per-field & resolusi item yang diparkir.

### 12.2 API / Feature Tests

- Registrasi, login, logout.
- CRUD produk + arsip.
- Lookup SKU / kode hasil scan (ditemukan / tidak).
- Pencarian produk (nama/SKU) + urutan katalog (`sort`) + saran `next-sku`.
- Metode pembayaran: default tunai, non tunai tersimpan, nilai tak dikenal ditolak, filter `payment_method`, pencarian nomor transaksi.
- Otorisasi lintas akun (user A tidak bisa akses data user B).
- Pembuatan transaksi + snapshot harga.
- Idempotensi transaksi (request ganda → satu transaksi).
- Konflik versi produk lintas perangkat (`409` + `error.details.current`, `force` menimpa).
- Penanganan request tidak valid.

### 12.3 Android Integration Tests

- Izin kamera (diberikan / ditolak).
- Scan valid / kode tidak terdaftar.
- Navigasi scanner → detail produk.
- Koneksi printer, test print, cetak & cetak ulang.
- Perilaku saat jaringan terputus.

### 12.4 Acceptance Tests (Definisi Siap Rilis)

**Terverifikasi otomatis** (backend `php artisan test`, mobile `npm run test.unit`):

- [x] Produk dapat ditambah & dicari lewat semua metode — isolasi, validasi SKU (termasuk pakai ulang setelah arsip), urutan katalog, dan tiap mode input tercakup test.
- [x] Kode dipindai menampilkan harga yang benar — lookup SKU/kode scan (ditemukan/tidak) teruji di API.
- [x] Data pengguna terisolasi — test lintas akun untuk produk, kategori, transaksi, dan struk (`404`).
- [x] Transaksi tersimpan dengan perhitungan benar — total/kembalian dihitung server, snapshot item teruji.
- [x] Request transaksi berulang tidak menghasilkan duplikasi — idempotency key teruji (`201` lalu `200`, satu baris).
- [x] Riwayat tetap konsisten walau harga produk berubah — snapshot nama/harga teruji.
- [x] Format data struk — layout 58 mm (32 kolom) & 80 mm (48 kolom), pembungkusan, dan perataan harga teruji.
- [x] Rate limit endpoint auth — `429 RATE_LIMITED` setelah 10 percobaan.
- [x] Edit produk yang bentrok tidak menimpa data perangkat lain — `409 CONFLICT` + baris server terkini, retry tanpa konflik, dan `force` teruji (backend & mobil).
- [x] Item yang bentrok diantrekan (bukan hilang) dan dapat diselesaikan per-field — status `conflict` + model perbandingan teruji.

**Menunggu verifikasi perangkat fisik** (lihat §10.5 & [docs/RELEASE-ANDROID.md](../docs/RELEASE-ANDROID.md)):

- [ ] Produk yang diperbarui terlihat dari perangkat lain (uji dua perangkat).
- [ ] Dua perangkat mengedit produk yang sama → dialog "Perubahan Bentrok" muncul dan pilihan "Pakai versi server"/"Simpan milik saya" berjalan.
- [ ] Struk tercetak pada printer yang didukung (Bluetooth / USB OTG / WiFi).
- [ ] Kegagalan printer tidak menghilangkan transaksi (matikan printer saat mencetak).
- [ ] Pemindaian kamera nyata dan perilaku izin kamera.
- [ ] Antrean offline lintas restart aplikasi di Android.

---

## 13. Roadmap Implementasi

### Phase 1 — Project Foundation

Setup Ionic React + TS, konfigurasi Capacitor Android, struktur folder & routing, setup Laravel + PostgreSQL, environment dev, autentikasi, testing & Git workflow.
**Deliverable:** app Android dasar + backend berjalan.

### Phase 2 — Product Catalog

Migrations, product API, category API, generator SKU, halaman katalog, form tambah/edit, arsip produk, validasi & pengujian.
**Deliverable:** katalog produk berfungsi via API.

### Phase 3 — Price Checker

Integrasi barcode scanner, lookup SKU (kode hasil scan), pencarian nama/SKU, tampilan detail harga, alur "tidak ditemukan", integrasi scanner ↔ form produk, uji di perangkat fisik.
**Deliverable:** price checker siap pakai. **(Puncak P0)**

### Phase 4 — Cloud Synchronization

TanStack Query, cache server state, refresh/invalidation, handling loading/error/offline, uji lintas perangkat, verifikasi isolasi data.
**Deliverable:** katalog tersinkron lintas perangkat.

### Phase 4.5 — Offline Write Queue

Outbox durable (SQLite di Android, localStorage di web), enqueue perubahan katalog saat offline, auto-flush saat online kembali, idempotency key pada `POST /products`, overlay optimistis di UI, indikator sinkronisasi & penanganan item gagal.
**Deliverable:** perubahan katalog saat offline tidak hilang dan tersinkron otomatis.

### Phase 5 — POS

Keranjang, kuantitas & kalkulasi, form pembayaran, transaksi backend, idempotency key, snapshot item, halaman sukses, riwayat & detail.
**Deliverable:** POS menyimpan transaksi dengan aman. *(selesai)*

### Phase 6 — Printer Integration

Pilih printer target, evaluasi plugin Bluetooth/ESC-POS, implementasi `PrinterService`, printer default, test print, format struk, cetak & cetak ulang, failure handling, uji fisik.
**Deliverable:** transaksi dapat dicetak. *(kode selesai; uji fisik tertunda — lihat §10.5)*

### Phase 7 — Stabilization & Release

Jalankan semua test, uji end-to-end, uji keamanan/isolasi data, uji jaringan lambat/gagal, pemulihan koneksi printer, konfigurasi production, backup DB, build & uji APK release, dokumentasi.
**Deliverable:** MVP siap dipakai pribadi. *(hardening + dokumentasi selesai; build APK debug sudah diverifikasi, sedangkan APK release bertanda tangan & uji perangkat/printer menunggu — lihat [docs/RELEASE-ANDROID.md](../docs/RELEASE-ANDROID.md))*

Yang sudah dikerjakan di Phase 7:

- **Test:** 64 test backend (isolasi kategori/produk/transaksi/struk, idempotensi, snapshot,
  rate limit, konflik versi, SKU=barcode, metode pembayaran, urutan katalog) dan 40 test mobile;
  Pint, ESLint, `tsc`, dan build produksi bersih.
- **Keamanan:** rate limit `auth` (10/menit) dan API terautentikasi (120/menit per pengguna);
  amplop error konsisten; isolasi data teruji lintas akun.
- **Konfigurasi produksi:** `.env.example` produksi (PostgreSQL, `APP_DEBUG=false`, HTTPS),
  dukungan `TRUSTED_PROXIES`, `config:cache` terverifikasi bebas closure.
- **Backup & restore:** prosedur `pg_dump`/`pg_restore` + retensi dan checklist go-live
  di [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).
- **Rilis Android:** signing release dari `keystore.properties` (opsional, aman bila tidak ada),
  `versionCode`/`versionName`, dan checklist verifikasi perangkat di
  [docs/RELEASE-ANDROID.md](../docs/RELEASE-ANDROID.md).

### Phase 8 — Resolusi Konflik Multi-Perangkat (P2)

Kolom `version` pada `products`, deteksi konflik optimistis pada `PATCH /products/{id}`
(`409 CONFLICT` + baris server terkini), pengecualian retry tanpa konflik, `force` untuk
"simpan milik saya", status `conflict` pada outbox, dan dialog perbandingan per-field
("Perubahan Bentrok") di header aplikasi.
**Deliverable:** edit dari dua perangkat tidak saling menimpa diam-diam; pengguna memilih pemenangnya. *(selesai)*

### Phase 9 — Penyatuan SKU & Redesain UI (P1)

Menggabungkan **SKU dan barcode** menjadi satu kolom `sku` (migrasi `merge_barcode_into_sku`,
lookup `?sku=`, `GET /products/next-sku`, unique hanya antar produk aktif) dan menambahkan
**metode pembayaran** (Tunai / Non Tunai) end-to-end. Aplikasi mobile dirombak mengikuti mockup:
sistem desain biru `#2563EB`, Splash + Login, 4 tab (Beranda · Produk · POS · Riwayat), serta
halaman Cek Harga, Pembayaran, dan Preview Struk sebagai halaman yang di-push (tanpa tab bar).
Keranjang dipindahkan ke provider bersama (memori), form produk memakai satu kolom “SKU / Barcode”
dengan tombol generate & scan, dan foto produk dihilangkan.
**Deliverable:** satu kode produk di seluruh alur (scan → cari → jual → struk) dan tampilan baru
yang konsisten dengan mockup. *(selesai; verifikasi perangkat menyusul)*

### Ketergantungan antar-Phase

```text
P1 ──▶ P2 ──▶ P3 ──▶ P4
                     │
                     ▼
                    P5 ──▶ P6 ──▶ P7 ──▶ P8 (P2) ──▶ P9
```

> **Checkpoint:** Jangan mulai P5 (POS) sebelum P3 (Price Checker) stabil dan teruji di perangkat fisik.

---

## 14. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Library printer tidak cocok dengan printer fisik | P6 terhambat | Pilih printer target lebih awal; abstraksi `PrinterService`; uji cepat |
| Race condition SKU/transaksi | Data ganda | Sequence/`FOR UPDATE` + unique constraint + retry |
| SKU duplikat lintas input | Data kotor | Partial unique index + validasi backend |
| Kualitas kamera/barcode sulit | UX buruk | Mode input manual sebagai fallback |
| Koneksi tidak stabil | Data terlihat "tersimpan" padahal tidak | Error eksplisit + TanStack Query retry + indikator status |
| Dua perangkat mengedit produk yang sama | Perubahan hilang tanpa jejak | Kolom `version` + `409 CONFLICT` + dialog resolusi eksplisit (§9.2) |
| Scope creep (stok, dll.) | MVP tidak selesai | Tegakkan Non-Goals §1.3 |

---

## 15. Definisi MVP Final

MVP selesai ketika pengguna dapat:

1. Login dari perangkat Android.
2. Menambah produk dengan SKU otomatis atau kode hasil scan.
3. Mengedit & mengarsipkan produk.
4. Mengecek harga via kamera atau pencarian.
5. Mengakses katalog yang sama dari beberapa perangkat.
6. Menambah produk ke keranjang.
7. Menyimpan transaksi dengan perhitungan benar.
8. Melihat riwayat transaksi.
9. Menghubungkan printer thermal Bluetooth yang didukung.
10. Mencetak & mencetak ulang struk tanpa membuat transaksi duplikat.

**Prioritas akhir:** selesaikan **katalog + Price Checker** dulu. Setelah inti stabil, kerjakan POS & printer. **Jangan** menambah manajemen stok atau fitur retail kompleks sebelum kebutuhan inti terpenuhi.

---

## 16. Distribusi APK & Notifikasi Pembaruan

Aplikasi dipasang lewat APK (bukan Play Store), jadi pembaruan tidak datang dengan sendirinya.
Alurnya:

1. Naikkan `versionCode` & `versionName` di `mobile/android/app/build.gradle` (§3 `docs/RELEASE-ANDROID.md`).
2. Build APK.
3. Terbitkan ke backend:

   ```bash
   cd backend
   php artisan release:publish ~/Downloads/warung-pos-debug.apk --notes="Perbaikan pemindai barcode"
   ```

   Perintah ini menyalin APK ke `storage/app/private/releases/`, dan mencatat `versionCode`,
   `versionName`, catatan, ukuran, serta `sha256` di tabel `app_releases`. `versionCode` yang sama
   akan **menggantikan** baris sebelumnya (berguna bila berkas perlu dibuild ulang), bukan membuat
   baris baru.

4. Setiap aplikasi yang terpasang memeriksa rilis terbaru **saat dibuka** (juga setelah buka ulang),
   membandingkan `version_code` dengan `versionCode` dirinya, lalu menampilkan strip
   **Versi x.y.z tersedia** di Beranda.

Endpoint (keduanya publik — pemeriksaan terjadi sebelum pengguna login):

| Method | Path | Keterangan |
|---|---|---|
| GET | `/api/v1/app/release` | Rilis terbaru: `version_code`, `version_name`, `notes`, `size_bytes`, `sha256`, `published_at`, `download_url` |
| GET | `/api/v1/app/release/download?version_code=` | Mengirim berkas APK versi tersebut; tanpa `version_code` = rilis terbaru |

Perilaku di aplikasi:

| Keadaan | Yang terjadi |
|---|---|
| Server punya `version_code` lebih besar | Strip tawaran muncul di Beranda (catatan rilis + ukuran berkas) |
| Sudah versi terbaru | Tidak ada apa-apa |
| Belum ada rilis / offline / backend tidak menjawab | Tidak ada apa-apa — aplikasi berjalan normal (kegagalan senyap) |
| Menekan **Nanti** | Versi itu disembunyikan (disimpan per versi); versi berikutnya tetap ditawarkan |
| Menekan **Perbarui** | APK diunduh lewat browser sistem, lalu pengguna menekan *Pasang* |

Catatan:

- `download_url` dibangun dari host permintaan, jadi tautan otomatis menunjuk ke alamat yang sama
  dengan yang dipakai aplikasi mengakses API (mis. IP Tailscale) — tidak perlu diatur manual.
- Unduhan diserahkan ke browser sistem karena Capacitor mengalihkan URL di luar origin aplikasi ke
  browser. Tidak perlu plugin tambahan maupun izin *install unknown apps* untuk aplikasi ini.
- Pembaruan hanya bisa **menimpa** aplikasi lama bila ditandatangani dengan **kunci yang sama**;
  berpindah keystore (mis. dari debug ke release) memaksa pengguna memasang ulang.
- **Belum termasuk:** push notification lewat FCM, sehingga notifikasi muncul walau aplikasi
  tertutup (kandidat P2, §G).
