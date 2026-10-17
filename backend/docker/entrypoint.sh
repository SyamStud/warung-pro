#!/bin/sh
#
# Persiapan container Warung POS sebelum nginx & php-fpm dijalankan supervisor:
# menunggu PostgreSQL, merapikan direktori tulis, menjalankan migrasi, dan
# menyemai akun demo pada database yang masih kosong.
#
# Sengaja TIDAK memakai `config:cache`: berkas .env hanya dibaca saat konfigurasi
# belum ter-cache, sehingga cache yang tertinggal di image bisa membuat perubahan
# .env diabaikan pada deploy berikutnya. Skala aplikasi ini tidak butuh itu.
set -e

cd /var/www/html

say() { printf '▸ %s\n' "$*"; }

# --- 1. Tunggu PostgreSQL ----------------------------------------------------
if [ "${DB_CONNECTION:-pgsql}" = "pgsql" ]; then
    say "Menunggu PostgreSQL di ${DB_HOST:-db}:${DB_PORT:-5432}…"

    percobaan=0
    while ! php -r '
        try {
            $dsn = sprintf(
                "pgsql:host=%s;port=%s;dbname=%s",
                getenv("DB_HOST") ?: "db",
                getenv("DB_PORT") ?: "5432",
                getenv("DB_DATABASE") ?: "warung",
            );
            new PDO($dsn, getenv("DB_USERNAME") ?: "warung", getenv("DB_PASSWORD") ?: "");

            exit(0);
        } catch (Throwable) {
            exit(1);
        }
    ' 2>/dev/null; do
        percobaan=$((percobaan + 1))

        if [ "$percobaan" -ge 60 ]; then
            say "PostgreSQL belum menjawab setelah 60 percobaan — berhenti."
            exit 1
        fi

        sleep 2
    done
fi

# --- 2. Direktori tulis ------------------------------------------------------
# Volume yang baru pertama kali dipakai mewarisi isi image, tapi tetap dipastikan
# supaya tidak ada peringatan izin setelah restore/backup.
mkdir -p \
    storage/app/private/releases \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache
chmod -R ug+rwX storage bootstrap/cache

# --- 3. Cache paket Composer -------------------------------------------------
# `composer install --no-scripts` di tahap build tidak menjalankan
# package:discover, jadi daftar paket disegarkan di sini.
php artisan package:discover
php artisan config:clear

# --- 4. Skema & data awal ----------------------------------------------------
say "Menjalankan migrasi…"
php artisan migrate --force

pengguna=$(php artisan tinker --execute='echo App\Models\User::query()->count();' 2>/dev/null | tr -dc '0-9')
pengguna=${pengguna:-0}

if [ "$pengguna" = "0" ]; then
    say "Database masih kosong — membuat akun demo…"
    php artisan db:seed --force
else
    say "Database sudah berisi ${pengguna} pengguna — seeder dilewati."
fi

say "Siap melayani di ${APP_URL:-http://localhost} (${APP_ENV:-production})."

exec "$@"
