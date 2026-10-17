#!/usr/bin/env bash
#
# deploy-server.sh — kirim backend ke server rumah dan jalankan dengan Docker.
#
#   scripts/deploy-server.sh
#
# Yang dilakukan:
#   1. menyalin folder backend/ ke server (tanpa vendor, .env, data lokal),
#   2. membuat .env sekali saja di server (APP_KEY & sandi database diacak),
#   3. `docker compose up -d --build` di server,
#   4. menunggu sampai API-nya menjawab.
#
# Setelan (bisa diubah lewat variabel lingkungan):
#   WARUNG_SERVER        tujuan SSH          (default: homeserver@main)
#   WARUNG_SERVER_DIR    folder di server    (default: /home/homeserver/warung)
#   WARUNG_BASE_URL      alamat publik API   (default: https://pos.syamlab.my.id)
#   WARUNG_TUNNEL_TOKEN  token Cloudflare Tunnel (opsional; kalau diisi, connector
#                        cloudflared ikut dijalankan di server)
#
# Sandi SSH tidak disimpan di sini: pakai kunci SSH, atau SSH_ASKPASS bila
# otentikasinya memakai sandi.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
Sumber="$ROOT/backend"

HOST="${WARUNG_SERVER:-homeserver@main}"
DIR="${WARUNG_SERVER_DIR:-/home/homeserver/warung}"
BASE_URL="${WARUNG_BASE_URL:-https://pos.syamlab.my.id}"

if [[ -t 1 ]]; then
  B=$'\033[1;34m'; G=$'\033[1;32m'; Y=$'\033[1;33m'; R=$'\033[1;31m'; N=$'\033[0m'
else
  B=""; G=""; Y=""; R=""; N=""
fi

say() { printf '%s▸%s %s\n' "$B" "$N" "$*"; }
ok() { printf '%s✓%s %s\n' "$G" "$N" "$*"; }
warn() { printf '%s!%s %s\n' "$Y" "$N" "$*" >&2; }
die() { printf '%s✗%s %s\n' "$R" "$N" "$*" >&2; exit 1; }

usage() {
  cat <<'TXT'
Kirim backend ke server rumah dan jalankan dengan Docker.

  scripts/deploy-server.sh

Variabel lingkungan:
  WARUNG_SERVER      tujuan SSH (default homeserver@main)
  WARUNG_SERVER_DIR  folder di server (default /home/homeserver/warung)
  WARUNG_BASE_URL    alamat publik API (default https://pos.syamlab.my.id)

Setelah selesai, terbitkan versi aplikasi dengan scripts/rilis.sh — rilis
dikirim ke server yang sama.
TXT
}

for arg in "$@"; do
  case "$arg" in
    -h | --help) usage; exit 0 ;;
    *) die "Argumen tidak dikenal: $arg (coba --help)" ;;
  esac
done

# --- Prasyarat lokal ---------------------------------------------------------

command -v ssh >/dev/null || die "ssh tidak ada di PATH."
command -v rsync >/dev/null || die "rsync tidak ada di PATH."
[[ -f "$Sumber/compose.yaml" ]] || die "Tidak menemukan $Sumber/compose.yaml"

# --- Prasyarat server --------------------------------------------------------

say "Memeriksa $HOST…"
ssh -o ConnectTimeout=15 "$HOST" 'command -v docker >/dev/null && docker compose version >/dev/null' ||
  die "Docker/Compose tidak siap di $HOST."
ok "Docker siap di $HOST"

# --- 1. Salin kode -----------------------------------------------------------

say "Menyalin backend ke $HOST:$DIR/backend…"
ssh "$HOST" "mkdir -p '$DIR/backend'"
rsync -az --delete \
  --exclude '.git' \
  --exclude '.env' \
  --exclude 'vendor/' \
  --exclude 'node_modules/' \
  --exclude 'database/*.sqlite' \
  --exclude 'database/*.sqlite-*' \
  --exclude 'storage/app/private/releases/' \
  --exclude 'storage/framework/cache/data/' \
  --exclude 'storage/framework/sessions/' \
  --exclude 'storage/framework/views/' \
  --exclude 'storage/logs/' \
  --exclude 'tests/' \
  "$Sumber/" "$HOST:$DIR/backend/"
ok "Kode tersalin"

# --- 2. Rahasia --------------------------------------------------------------

# Token Cloudflare Tunnel (opsional): dikirim lewat WARUNG_TUNNEL_TOKEN, ditulis
# ke .env server, dan tidak pernah masuk repo. Connector-nya ikut dijalankan
# begitu token itu ada.
if [[ -n "${WARUNG_TUNNEL_TOKEN:-}" ]]; then
  if ssh "$HOST" "grep -q '^TUNNEL_TOKEN=' '$DIR/backend/.env'"; then
    say "Memperbarui TUNNEL_TOKEN di .env server…"
    ssh "$HOST" "sed -i 's|^TUNNEL_TOKEN=.*|TUNNEL_TOKEN=${WARUNG_TUNNEL_TOKEN}|' '$DIR/backend/.env'"
  else
    say "Menambahkan TUNNEL_TOKEN ke .env server…"
    ssh "$HOST" "printf 'TUNNEL_TOKEN=%s\n' '${WARUNG_TUNNEL_TOKEN}' >> '$DIR/backend/.env'"
  fi
  ok "TUNNEL_TOKEN tersimpan di server"
fi

# .env dibuat sekali dan tidak pernah ditimpa: APP_KEY tidak boleh berubah,
# karena semua token & sesi yang beredar ditandatangani dengan kunci itu.
if ssh "$HOST" "test -f '$DIR/backend/.env'"; then
  ok ".env sudah ada di server — dibiarkan apa adanya"
else
  say "Membuat .env baru di server (APP_KEY & sandi database diacak)…"

  app_key="base64:$(openssl rand -base64 32)"
  db_password="$(openssl rand -hex 16)"

  ssh "$HOST" "umask 077 && cat > '$DIR/backend/.env'" <<ENV
APP_NAME="Warung POS"
APP_ENV=production
APP_KEY=$app_key
APP_DEBUG=false
APP_URL=$BASE_URL
APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US
APP_MAINTENANCE_DRIVER=file
LOG_CHANNEL=stack
LOG_STACK=single
LOG_LEVEL=warning
BCRYPT_ROUNDS=12
DB_CONNECTION=pgsql
DB_HOST=db
DB_PORT=5432
DB_DATABASE=warung
DB_USERNAME=warung
DB_PASSWORD=$db_password
SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=null
BROADCAST_CONNECTION=log
FILESYSTEM_DISK=local
QUEUE_CONNECTION=database
CACHE_STORE=database
MAIL_MAILER=log
TRUSTED_PROXIES=*
ENV

  ssh "$HOST" "chmod 600 '$DIR/backend/.env'"
  ok ".env dibuat (mode 600)"
  warn "Akun demo disemai otomatis saat database masih kosong (demo@warung.test / password)."
fi

# --- 3. Jalankan container ---------------------------------------------------

profil=""
if ssh "$HOST" "grep -q '^TUNNEL_TOKEN=.' '$DIR/backend/.env'"; then
  profil="--profile tunnel"
  ok "Tunnel Cloudflare ikut dijalankan (TUNNEL_TOKEN ada di .env)"
fi

say "Membangun & menjalankan container (bisa beberapa menit saat pertama)…"
ssh "$HOST" "cd '$DIR/backend' && docker compose $profil up -d --build"

# --- 4. Tunggu sampai menjawab ----------------------------------------------

say "Menunggu API menjawab…"
siap=0
for _ in $(seq 1 60); do
  if ssh "$HOST" 'curl -fsS -o /dev/null -m 5 http://127.0.0.1:7001/up' 2>/dev/null; then
    siap=1
    break
  fi
  sleep 2
done

if ((siap == 0)); then
  warn "API belum menjawab. 30 baris log terakhir:"
  ssh "$HOST" "cd '$DIR/backend' && docker compose logs --tail=30" || true
  die "Deploy gagal — periksa log di atas."
fi

ok "API menjawab di http://127.0.0.1:7001 (server)"

ssh "$HOST" "cd '$DIR/backend' && docker compose ps --format 'table {{.Service}}\t{{.Status}}'"

cat <<TXT

Alamat publik : $BASE_URL
Lokal di server: http://127.0.0.1:7001

Langkah setelah ini:
  1. Buat rute publik di dashboard Cloudflare Zero Trust:
       pos.syamlab.my.id  →  http://app:80   (atau http://<ip-server>:7001)
  2. Pastikan aplikasi memakai $BASE_URL/api/v1 sebagai VITE_API_BASE_URL.
  3. Terbitkan versi aplikasi: scripts/rilis.sh "catatan rilis"
TXT
