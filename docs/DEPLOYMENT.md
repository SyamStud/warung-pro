# Deployment Backend & Backup

Panduan menaikkan API Laravel (`backend/`) ke produksi, plus prosedur backup/restore
database. Untuk rilis aplikasi Android, lihat [RELEASE-ANDROID.md](./RELEASE-ANDROID.md).

---

## 1. Ringkasan Target Produksi

```text
[ Aplikasi Android ] ──HTTPS──▶ [ nginx ] ──▶ [ php-fpm + Laravel ] ──▶ [ PostgreSQL ]
```

- PHP >= 8.5, Composer, nginx, PHP-FPM.
- Database: **PostgreSQL >= 15** (lihat `backend/.env.example`).
- HTTPS wajib (Let's Encrypt/Certbot atau sertifikat lain).
- Endpoint kesehatan: `GET /up`.

---

## 2. Menyiapkan Aplikasi

```bash
cd backend

composer install --no-dev --optimize-autoloader

cp .env.example .env
php artisan key:generate
```

Sunting `.env` untuk produksi (lihat §3), lalu:

```bash
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan event:cache
```

Aset view:

```bash
php artisan view:cache
```

Setiap kali `.env` atau `config/*` berubah, jalankan ulang
`php artisan config:cache` (dan `config:clear` bila perlu debug).

> **Catatan:** konfigurasi proyek ini bebas closure (sudah diuji dengan
> `php artisan config:cache`), sehingga aman untuk cache konfigurasi.

---

## 3. Variabel `.env` Produksi

```dotenv
APP_NAME="Warung POS"
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.example.com
LOG_LEVEL=warning

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=warung
DB_USERNAME=warung
DB_PASSWORD=<password-kuat>

SESSION_ENCRYPT=true
CACHE_STORE=redis          # atau database
QUEUE_CONNECTION=database  # atau redis

# Bila ada reverse proxy yang menutup TLS:
TRUSTED_PROXIES=127.0.0.1
```

- `APP_DEBUG=false` wajib: `true` membocorkan stack trace dan kredensial.
- `TRUSTED_PROXIES` hanya diisi IP proxy yang benar-benar dipercaya; jangan `*`
  kecuali semua trafik memang melewati proxy tepercaya.
- Jangan commit `.env` produksi.

---

## 4. nginx + PHP-FPM (contoh)

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate     /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    root /var/www/warung/backend/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.5-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
    }

    location ~ /\.(?!well-known).* { deny all; }
}

server {
    listen 80;
    server_name api.example.com;
    return 301 https://$host$request_uri;
}
```

Hak akses:

```bash
chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rw storage bootstrap/cache
```

Rate limiting (sudah aktif di aplikasi):

- `POST /auth/login` dan `/auth/register`: **10 permintaan/menit** per `email+IP`.
- API terautentikasi: **120 permintaan/menit** per pengguna.

Balasan melampaui batas: `429` dengan `error.code = RATE_LIMITED`.

---

## 5. Queue Worker (opsional)

Saat ini antrean offline diproses di sisi klien dan tidak memerlukan worker.
Jika nanti memakai job Laravel:

```ini
# /etc/systemd/system/warung-queue.service
[Unit]
Description=Warung queue worker
After=network.target

[Service]
User=www-data
Restart=always
WorkingDirectory=/var/www/warung/backend
ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable --now warung-queue
php artisan queue:restart   # setiap kali kode berubah
```

---

## 6. Backup Database

### PostgreSQL (produksi)

Backup harian (format custom, terkompresi):

```bash
#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR=/var/backups/warung
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"

pg_dump --format=custom --no-owner --file="$BACKUP_DIR/warung-$STAMP.dump" warung

# Simpan 14 hari terakhir.
find "$BACKUP_DIR" -name 'warung-*.dump' -mtime +14 -delete
```

Simpan sebagai `/usr/local/bin/warung-backup` (chmod +x) dan jadwalkan:

```cron
15 2 * * * /usr/local/bin/warung-backup >> /var/log/warung-backup.log 2>&1
```

Salin hasil backup ke lokasi lain (S3/NAS) — backup di mesin yang sama bukan backup.

### SQLite (hanya pengembangan lokal)

```bash
sqlite3 backend/database/database.sqlite ".backup 'backup-$STAMP.sqlite'"
```

---

## 7. Restore Database

```bash
# Hentikan penulisan (matikan queue worker, mode maintenance).
php artisan down

# Restore ke database bersih.
dropdb warung
createdb -O warung warung
pg_restore --no-owner --role=warung -d warung /var/backups/warung/warung-YYYYMMDD-HHMMSS.dump

php artisan migrate --force   # bila ada migrasi setelah backup
php artisan up
```

Verifikasi setelah restore:

```bash
curl -fsS https://api.example.com/up
php artisan tinker --execute 'echo App\Models\Transaction::count();'
```

---

## 8. Checklist Go-Live

- [ ] `APP_ENV=production`, `APP_DEBUG=false`, `APP_URL` HTTPS.
- [ ] `APP_KEY` di-generate (`php artisan key:generate`).
- [ ] Migrasi jalan (`php artisan migrate --force`).
- [ ] `config:cache`, `route:cache`, `view:cache` dijalankan.
- [ ] HTTPS valid; HTTP dialihkan ke HTTPS.
- [ ] `storage/` & `bootstrap/cache/` writable oleh user web server.
- [ ] Backup terjadwal + **diuji restore** minimal sekali.
- [ ] `GET /up` membalas 200.
- [ ] Rate limit auth terverifikasi (`429` setelah 10 percobaan).
- [ ] Log tidak memuat token/password.
