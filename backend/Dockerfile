# syntax=docker/dockerfile:1

# =============================================================================
# Warung POS — API Laravel dalam satu container (nginx + php-fpm).
#
#   cd backend && docker compose up -d --build
#
# Backend ini murni API JSON: tidak ada aset frontend yang perlu dibundel.
# APK rilis disimpan di volume `app-storage`, bukan di dalam image, jadi
# menerbitkan versi baru tidak memaksa image dibangun ulang.
# =============================================================================

# --- Tahap 1: dependensi Composer (tanpa perkakas pengembangan) --------------
FROM composer:2 AS vendor

WORKDIR /app

COPY composer.json composer.lock ./

RUN composer install \
        --no-dev \
        --no-interaction \
        --no-progress \
        --prefer-dist \
        --no-scripts \
        --optimize-autoloader

# --- Tahap 2: runtime --------------------------------------------------------
FROM php:8.5-fpm-alpine AS app

# nginx + supervisor (satu container), headers PostgreSQL untuk pdo_pgsql, dan
# tzdata supaya tanggal mengikuti zona waktu container.
#
# OPcache tidak dipasang: image php:8.5-fpm-alpine sudah membawanya (Zend
# OPcache ada di `php -m`), dan `docker-php-ext-install opcache` gagal di sana
# karena ekstensi itu ikut dikompilasi bersama PHP-nya.
RUN apk add --no-cache nginx supervisor postgresql-dev tzdata \
    && docker-php-ext-install -j"$(nproc)" pdo_pgsql \
    && rm -rf /var/cache/apk/* /tmp/pear

WORKDIR /var/www/html

COPY --from=vendor /app/vendor ./vendor
COPY . .

RUN mkdir -p \
        storage/app/private/releases \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        bootstrap/cache \
    && rm -f /etc/nginx/http.d/default.conf \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwX storage bootstrap/cache

COPY docker/nginx-main.conf /etc/nginx/nginx.conf
COPY docker/site.conf /etc/nginx/http.d/warung.conf
COPY docker/php-fpm.conf /usr/local/etc/php-fpm.d/zz-warung.conf
COPY docker/opcache.ini /usr/local/etc/php/conf.d/zz-opcache.ini
# Menggantikan konfigurasi bawaan paket Alpine (lihat berkasnya).
COPY docker/supervisord.conf /etc/supervisord.conf
COPY docker/entrypoint.sh /usr/local/bin/warung-entrypoint

RUN chmod +x /usr/local/bin/warung-entrypoint

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/warung-entrypoint"]
CMD ["supervisord", "-c", "/etc/supervisord.conf", "-n"]
