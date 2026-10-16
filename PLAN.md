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
| G3 | Katalog dapat dicari (nama/SKU/barcode) | Semua mode pencarian mengembalikan hasil benar |
| G4 | Kasir sederhana + cetak struk | Transaksi tersimpan & struk tercetak |
| G5 | Data konsisten lintas perangkat | Perubahan produk terlihat di perangkat lain setelah refresh |

### 1.2 Prinsip Pengembangan

- **Price Checker dulu, POS kemudian.** Jangan menyentuh fitur retail kompleks sebelum inti stabil.
- **Server-authoritative.** Harga, total, dan perhitungan lain dihitung backend — aplikasi tidak dipercaya.
- **Tanpa manajemen stok.** Tidak ada tabel/flow stok, mutasi, atau opname di MVP.
- **Produk boleh punya SKU saja, barcode saja, atau keduanya.**
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
│  Auth (Sanctum) · Products · Categories · Barcode Lookup            │
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
- [ ] Penyimpanan token aman (Capacitor Secure Storage / Keystore). *(saat ini Capacitor Preferences)*
- [x] Ambil profil pengguna (`GET /me`).
- [x] Otorisasi berbasis kepemilikan data (semua query ter-scope `user_id`).
- [x] Satu akun dipakai dari beberapa perangkat.

### B. Product Management (P0)

- [x] Daftar produk (pagination).
- [x] Tambah / lihat detail / edit produk.
- [x] Arsipkan produk (soft delete).
- [x] Pencarian by **nama**, **SKU**, **barcode**.
- [x] Input barcode via kamera atau manual.
- [x] Generate SKU otomatis (backend).
- [x] Validasi SKU & barcode duplikat.
- [x] Kategori produk (sederhana: list + create).

### C. Price Checker (P0)

- [x] Scan barcode via kamera.
- [x] Tampilkan produk + harga setelah barcode ditemukan.
- [x] Tampilkan harga jual, SKU, dan barcode dengan jelas.
- [x] Pencarian manual (nama/SKU/barcode).
- [x] Status "barcode tidak ditemukan" + aksi tambah produk.
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

---

## 4. Layar Aplikasi

Navigasi utama: **4 tab**. Semua tab dapat diakses setelah login.

### 4.1 Price Checker (tab default)

| Elemen | Perilaku |
|---|---|
| Tombol **Scan** | Buka kamera → dapatkan barcode → panggil `lookup` |
| Search bar | Cari nama/SKU/barcode, debounce 300 ms |
| Hasil pencarian | List produk (nama, SKU, harga) |
| Detail produk | Nama, harga besar, SKU, barcode, kategori, unit |
| State "tidak ditemukan" | Pesan jelas + tombol **Tambah produk** (barcode terisi otomatis) |
| Error state | Izin kamera ditolak / scanner gagal / jaringan putus |

### 4.2 Products

Daftar produk + pencarian + filter kategori + tombol tambah. Form tambah/edit dengan pilihan **scan barcode** atau input manual, **SKU otomatis** atau manual, serta tombol arsip.

### 4.3 POS

Scanner & pencarian, daftar keranjang, kontrol kuantitas, ringkasan subtotal/total, form pembayaran, info kembalian, tombol simpan transaksi, tombol cetak struk.

### 4.4 History

Daftar transaksi (nomor, tanggal, total), detail transaksi (item + pembayaran), tombol cetak ulang.

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
| sku | VARCHAR | SKU internal |
| barcode | VARCHAR, NULL | Barcode produk |
| unit | VARCHAR | Satuan (pcs, kg, dst.) |
| selling_price | BIGINT | Harga jual (rupiah, integer) |
| notes | TEXT, NULL | Catatan |
| is_active | BOOLEAN | Status produk |
| created_at / updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP, NULL | Soft delete |

**Ketentuan & constraint:**

- `UNIQUE (user_id, sku)`.
- `UNIQUE (user_id, barcode)` untuk barcode **non-NULL** (partial unique index di PostgreSQL).
- Produk tanpa barcode tetap valid.
- `selling_price >= 0` (check constraint).
- Produk yang sudah dipakai transaksi **diarsipkan**, bukan dihapus permanen.
- Index: `name`, `sku`, `barcode`.

Contoh partial unique index:

```sql
CREATE UNIQUE INDEX products_user_barcode_unique
  ON products (user_id, barcode)
  WHERE barcode IS NOT NULL AND deleted_at IS NULL;
```

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
| idempotency_key | VARCHAR, NULL | Kunci anti-duplikat |
| created_at / updated_at | TIMESTAMP | |

Constraint: `UNIQUE (user_id, idempotency_key)` untuk key non-NULL. Index `(user_id, created_at DESC)`.

### 5.5 `transaction_items`

| Field | Type | Keterangan |
|---|---|---|
| id | BIGINT PK | |
| transaction_id | BIGINT FK → transactions (cascade) | Relasi |
| product_id | BIGINT FK → products, NULL | Referensi (boleh null bila produk terhapus) |
| product_name | VARCHAR | Snapshot nama |
| sku | VARCHAR, NULL | Snapshot SKU |
| barcode | VARCHAR, NULL | Snapshot barcode |
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
| GET | `/products` | Daftar & pencarian (`search`, `category_id`, `page`, `per_page`) |
| POST | `/products` | Buat produk |
| GET | `/products/{id}` | Detail produk |
| PATCH | `/products/{id}` | Update produk |
| DELETE | `/products/{id}` | Arsipkan (soft delete) |
| GET | `/products/lookup?barcode={code}` | Lookup barcode |

### 6.3 Categories

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/categories` | Daftar kategori |
| POST | `/categories` | Buat kategori |

### 6.4 Transactions

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/transactions` | Simpan transaksi (idempotent) |
| GET | `/transactions` | Daftar transaksi (pagination) |
| GET | `/transactions/{id}` | Detail transaksi |
| GET | `/transactions/{id}/receipt` | Data untuk cetak struk |

### 6.5 Contoh Kontrak

**Create product**

```http
POST /api/v1/products
Content-Type: application/json

{
  "name": "Air Mineral 600ml",
  "sku": null,                 // null → backend generate otomatis
  "barcode": "8991234567890",  // boleh null
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
    "barcode": "8991234567890",
    "unit": "pcs",
    "selling_price": 4000,
    "category_id": 2,
    "is_active": true
  }
}
```

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

Kode error: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION_ERROR`, `CONFLICT` (duplikat), `RATE_LIMITED`, `SERVER_ERROR`.

### 6.6 API Rules

- Semua endpoint privat butuh autentikasi; pengguna hanya akses data miliknya.
- Validasi request di backend (Form Request + Zod-equivalent rules).
- SKU & transaction_number dibuat **aman terhadap request bersamaan** (§7).
- Total transaksi dihitung dari harga produk valid di DB — bukan dari client.
- Idempotency key untuk operasi pembayaran (header `Idempotency-Key`).
- Format error konsisten.
- Rate limiting pada endpoint auth.

---

## 7. Aturan SKU & Barcode

SKU internal dan barcode **dipisahkan**.

### Mode 1 — Scan Barcode

Scan → `GET /products/lookup?barcode=...`:

- **Ditemukan** → tampilkan produk + harga.
- **Tidak ditemukan** → tampilkan opsi tambah produk; barcode terisi otomatis di form; SKU tetap bisa otomatis.

### Mode 2 — Auto-Generated SKU

Format: `PRD-{6 digit urut}` → `PRD-000042`.

**Jangan** basis jumlah produk (race condition). Gunakan salah satu:

- **PostgreSQL sequence** khusus + `lpad`, atau
- tabel `counters` dengan `SELECT ... FOR UPDATE` di dalam transaksi, atau
- ULID/NanoID **dengan prefix** bila human-readability tidak diprioritaskan.

Retry otomatis bila unique constraint gagal karena race.

### Mode 3 — Manual Input

Pengguna memasukkan SKU/barcode manual. Backend memvalidasi duplikasi sebelum menyimpan dan mengembalikan `409 CONFLICT` bila bentrok.

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

**Masih Pasca-MVP (P2):** SQLite cache katalog persisten, pencarian offline penuh, antrean transaksi offline, resolusi konflik multi-perangkat, backup/restore.

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

Nama toko · nomor transaksi · tanggal & waktu · nama produk · kuantitas · harga satuan · total per item · subtotal · diskon · total · nominal dibayar · kembalian · pesan penutup opsional.

### 10.4 Failure Handling

- Transaksi tetap tersimpan walau printer gagal.
- Status cetak terpisah dari status transaksi.
- Pengguna dapat mencoba cetak ulang.
- Cetak ulang **tidak** membuat transaksi baru.
- Sediakan test print sebelum dipakai untuk transaksi.

### 10.5 Verifikasi di Perangkat Fisik (belum dilakukan)

Encoder struk sudah diuji otomatis (lebar 58/80 mm, pembungkusan baris, perataan harga).
Yang **belum** bisa diverifikasi di lingkungan pengembangan (tidak ada Android SDK/printer):

1. Build APK: `cd mobile && npm run build && npx cap sync android`, lalu `./gradlew assembleDebug` di Android Studio.
2. Pasangkan printer di pengaturan sistem Android (Bluetooth) atau sambungkan via OTG (USB).
3. Buka **Riwayat → ikon printer** (atau ikon printer di tab Kasir), pilih jenis koneksi, "Cari perangkat",
   pilih printer, atur lebar kertas, lalu **Cetak uji**.
4. Cetak struk nyata dari detail transaksi dan dari dialog sukses checkout (tombol "Cetak struk").

Risiko yang perlu diperhatikan saat build native pertama: plugin menarik `usb-serial-for-android`
via JitPack dan `kotlin-stdlib` 2.2.10 (lihat `android/build.gradle` plugin) — sesuaikan versi
Gradle/Kotlin aplikasi bila ada konflik.

---

## 11. Keamanan & Keandalan

- HTTPS untuk seluruh komunikasi.
- Password di-hash aman (bcrypt/argon2).
- Token dapat dicabut (Sanctum).
- Otorisasi berbasis pemilik data di setiap query.
- Validasi seluruh input di backend.
- Rate limiting endpoint auth.
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
- Validasi duplikat SKU/barcode.
- Format data struk.

### 12.2 API / Feature Tests

- Registrasi, login, logout.
- CRUD produk + arsip.
- Lookup barcode (ditemukan / tidak).
- Pencarian produk (nama/SKU/barcode).
- Otorisasi lintas akun (user A tidak bisa akses data user B).
- Pembuatan transaksi + snapshot harga.
- Idempotensi transaksi (request ganda → satu transaksi).
- Penanganan request tidak valid.

### 12.3 Android Integration Tests

- Izin kamera (diberikan / ditolak).
- Scan valid / barcode tidak terdaftar.
- Navigasi scanner → detail produk.
- Koneksi printer, test print, cetak & cetak ulang.
- Perilaku saat jaringan terputus.

### 12.4 Acceptance Tests (Definisi Siap Rilis)

**Terverifikasi otomatis** (backend `php artisan test`, mobile `npm run test.unit`):

- [x] Produk dapat ditambah & dicari lewat semua metode — isolasi, validasi SKU/barcode, dan tiap mode input tercakup test.
- [x] Barcode dipindai menampilkan harga yang benar — lookup barcode (ditemukan/tidak) teruji di API.
- [x] Data pengguna terisolasi — test lintas akun untuk produk, kategori, transaksi, dan struk (`404`).
- [x] Transaksi tersimpan dengan perhitungan benar — total/kembalian dihitung server, snapshot item teruji.
- [x] Request transaksi berulang tidak menghasilkan duplikasi — idempotency key teruji (`201` lalu `200`, satu baris).
- [x] Riwayat tetap konsisten walau harga produk berubah — snapshot nama/harga teruji.
- [x] Format data struk — layout 58 mm (32 kolom) & 80 mm (48 kolom), pembungkusan, dan perataan harga teruji.
- [x] Rate limit endpoint auth — `429 RATE_LIMITED` setelah 10 percobaan.

**Menunggu verifikasi perangkat fisik** (lihat §10.5 & [docs/RELEASE-ANDROID.md](../docs/RELEASE-ANDROID.md)):

- [ ] Produk yang diperbarui terlihat dari perangkat lain (uji dua perangkat).
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

Integrasi barcode scanner, lookup barcode, pencarian nama/SKU, tampilan detail harga, alur "tidak ditemukan", integrasi scanner ↔ form produk, uji di perangkat fisik.
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
**Deliverable:** MVP siap dipakai pribadi. *(hardening + dokumentasi selesai; build & uji APK release menunggu Android SDK/printer — lihat [docs/RELEASE-ANDROID.md](../docs/RELEASE-ANDROID.md))*

Yang sudah dikerjakan di Phase 7:

- **Test:** 50 test backend (isolasi kategori/produk/transaksi/struk, idempotensi, snapshot, rate limit)
  dan 24 test mobile; Pint, ESLint, `tsc`, dan build produksi bersih.
- **Keamanan:** rate limit `auth` (10/menit) dan API terautentikasi (120/menit per pengguna);
  amplop error konsisten; isolasi data teruji lintas akun.
- **Konfigurasi produksi:** `.env.example` produksi (PostgreSQL, `APP_DEBUG=false`, HTTPS),
  dukungan `TRUSTED_PROXIES`, `config:cache` terverifikasi bebas closure.
- **Backup & restore:** prosedur `pg_dump`/`pg_restore` + retensi dan checklist go-live
  di [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md).
- **Rilis Android:** signing release dari `keystore.properties` (opsional, aman bila tidak ada),
  `versionCode`/`versionName`, dan checklist verifikasi perangkat di
  [docs/RELEASE-ANDROID.md](../docs/RELEASE-ANDROID.md).


### Ketergantungan antar-Phase

```text
P1 ──▶ P2 ──▶ P3 ──▶ P4
                     │
                     ▼
                    P5 ──▶ P6 ──▶ P7
```

> **Checkpoint:** Jangan mulai P5 (POS) sebelum P3 (Price Checker) stabil dan teruji di perangkat fisik.

---

## 14. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Library printer tidak cocok dengan printer fisik | P6 terhambat | Pilih printer target lebih awal; abstraksi `PrinterService`; uji cepat |
| Race condition SKU/transaksi | Data ganda | Sequence/`FOR UPDATE` + unique constraint + retry |
| Barcode duplikat lintas input | Data kotor | Partial unique index + validasi backend |
| Kualitas kamera/barcode sulit | UX buruk | Mode input manual sebagai fallback |
| Koneksi tidak stabil | Data terlihat "tersimpan" padahal tidak | Error eksplisit + TanStack Query retry + indikator status |
| Scope creep (stok, dll.) | MVP tidak selesai | Tegakkan Non-Goals §1.3 |

---

## 15. Definisi MVP Final

MVP selesai ketika pengguna dapat:

1. Login dari perangkat Android.
2. Menambah produk dengan SKU otomatis atau barcode hasil scan.
3. Mengedit & mengarsipkan produk.
4. Mengecek harga via kamera atau pencarian.
5. Mengakses katalog yang sama dari beberapa perangkat.
6. Menambah produk ke keranjang.
7. Menyimpan transaksi dengan perhitungan benar.
8. Melihat riwayat transaksi.
9. Menghubungkan printer thermal Bluetooth yang didukung.
10. Mencetak & mencetak ulang struk tanpa membuat transaksi duplikat.

**Prioritas akhir:** selesaikan **katalog + Price Checker** dulu. Setelah inti stabil, kerjakan POS & printer. **Jangan** menambah manajemen stok atau fitur retail kompleks sebelum kebutuhan inti terpenuhi.
