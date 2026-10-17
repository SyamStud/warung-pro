#!/usr/bin/env bash
#
# rilis.sh — terbitkan versi baru aplikasi dalam satu perintah.
#
#   scripts/rilis.sh "Perbaikan cetak struk"
#
# Alur: naikkan versionCode & versionName di mobile/android/app/build.gradle
#       → build APK → terbitkan ke backend (php artisan release:publish),
#       sehingga setiap aplikasi yang sudah terpasang ditawari pembaruan ini
#       saat dibuka. Rincian: PLAN.md §16.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRADLE="$ROOT/mobile/android/app/build.gradle"
BACKEND="$ROOT/backend"

# Tujuan penerbitan rilis: server rumah (default) atau backend di mesin ini.
HOST="${WARUNG_SERVER:-homeserver@main}"
SERVER_DIR="${WARUNG_SERVER_DIR:-/home/homeserver/warung}"

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
Terbitkan versi baru aplikasi dalam satu perintah.

  scripts/rilis.sh "Perbaikan cetak struk"

Alur: naikkan versionCode/versionName di mobile/android/app/build.gradle
      → build APK → terbitkan ke server (Docker), sehingga setiap aplikasi yang
      sudah terpasang ditawari pembaruan ini saat dibuka.

Opsi:
  -c, --catatan "..."   Catatan rilis yang tampil di aplikasi.
      --versi X.Y.Z     Set versionName (default: angka terakhir dinaikkan).
      --naik N          Tambah versionCode sebanyak N (default 1).
      --release         Build APK release bertanda tangan (butuh keystore).
      --lokal           Terbitkan ke backend di mesin ini, bukan ke server.
      --tanpa-terbit    Hanya build APK, jangan diterbitkan.
      --paksa           Izinkan versionCode yang tidak lebih baru dari rilis terbit.
  -h, --help            Tampilkan bantuan ini.

Variabel lingkungan:
  WARUNG_SERVER      tujuan SSH (default homeserver@main)
  WARUNG_SERVER_DIR  folder backend di server (default /home/homeserver/warung)
TXT
}

catatan=""
versi=""
naik=1
mode="debug"
paksa=0
terbitkan=1
tujuan="server"

while (( $# > 0 )); do
  case "$1" in
    -c | --catatan) catatan="${2:?--catatan butuh nilai}"; shift 2 ;;
    --versi) versi="${2:?--versi butuh nilai}"; shift 2 ;;
    --naik) naik="${2:?--naik butuh nilai}"; shift 2 ;;
    --release) mode="release"; shift ;;
    --lokal) tujuan="lokal"; shift ;;
    --tanpa-terbit) terbitkan=0; shift ;;
    --paksa) paksa=1; shift ;;
    -h | --help) usage; exit 0 ;;
    -*) die "Opsi tidak dikenal: $1 (coba --help)" ;;
    *) catatan="${catatan:-$1}"; shift ;;
  esac
done

# --- Prasyarat ------------------------------------------------------------

[[ -f "$GRADLE" ]] || die "Tidak menemukan $GRADLE"
[[ -f "$BACKEND/artisan" ]] || die "Tidak menemukan $BACKEND/artisan"
command -v npm >/dev/null || die "npm tidak ada di PATH."
command -v php >/dev/null || die "php tidak ada di PATH."

# Capacitor 8 menargetkan Java 21: dengan JDK 17 build berhenti dengan
# "invalid source release: 21", jadi jangan percaya begitu saja JAVA_HOME yang
# kebetulan sudah ada di lingkungan — cari JDK 21 yang benar.
java_major() { "$1/bin/java" -version 2>&1 | sed -n '1s/.*version "\([0-9]*\).*/\1/p'; }

kandidat=()
if [[ -n "${JAVA_HOME:-}" ]]; then kandidat+=("$JAVA_HOME"); fi
for dir in "$HOME"/.local/lib/jdk-21* /usr/lib/jvm/*21*; do
  if [[ -d "$dir" ]]; then kandidat+=("$dir"); fi
done

java_home=""
for dir in ${kandidat[@]+"${kandidat[@]}"}; do
  if [[ -x "$dir/bin/java" && "$(java_major "$dir")" == "21" ]]; then
    java_home="$dir"
    break
  fi
done

[[ -n "$java_home" ]] || die "JDK 21 tidak ditemukan (yang aktif: ${JAVA_HOME:-(tidak di-set)}).
  Capacitor 8 menargetkan Java 21; JDK 17 gagal dengan \"invalid source release: 21\".
  Set manual: export JAVA_HOME=/path/ke/jdk-21"
export JAVA_HOME="$java_home"

ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
[[ -d "$ANDROID_HOME" ]] || die "ANDROID_HOME tidak ditemukan: $ANDROID_HOME"
export ANDROID_HOME

if [[ "$mode" == "release" ]]; then
  [[ -f "$ROOT/mobile/android/keystore.properties" ]] ||
    die "Belum ada mobile/android/keystore.properties — ikuti docs/RELEASE-ANDROID.md §4 dulu."
fi

# --- Versi lama → versi baru ---------------------------------------------

kode_lama="$(sed -n 's/.*versionCode[[:space:]]\+\([0-9]\+\).*/\1/p' "$GRADLE" | head -1)"
nama_lama="$(sed -n 's/.*versionName[[:space:]]"\([^"]*\)".*/\1/p' "$GRADLE" | head -1)"
[[ -n "$kode_lama" && -n "$nama_lama" ]] || die "versionCode/versionName tidak terbaca dari $GRADLE"

kode_baru=$((kode_lama + naik))

if [[ -n "$versi" ]]; then
  nama_baru="$versi"
elif [[ "$nama_lama" =~ ^(.*\.)?([0-9]+)$ ]]; then
  nama_baru="${BASH_REMATCH[1]}$((BASH_REMATCH[2] + 1))"
else
  die "versionName \"$nama_lama\" tidak berbentuk angka. Tentukan manual: --versi X.Y.Z"
fi

# Versi tertinggi yang sudah terbit di tujuan penerbitan. Kosong berarti gagal
# membaca (mis. container di server belum jalan).
kode_terbit_lokal() {
  (cd "$BACKEND" && php artisan tinker \
    --execute="echo (int) (App\Models\AppRelease::query()->max('version_code') ?? 0);" \
    2>/dev/null | tr -dc '0-9')
}

kode_terbit_server() {
  local perintah
  perintah="bash -s -- $(printf '%q' "$SERVER_DIR")"

  ssh -o ConnectTimeout=15 "$HOST" "$perintah" <<'REMOTE' 2>/dev/null | tr -dc '0-9'
set -euo pipefail
cd "$1/backend"
docker compose exec -T app php artisan tinker \
  --execute='echo (int) (App\Models\AppRelease::query()->max("version_code") ?? 0);'
REMOTE
}

# Salin APK ke server, lalu jalankan release:publish di dalam container.
# versionCode/versionName dikirim eksplisit karena proyek mobile tidak ada di server.
terbitkan_ke_server() {
  local apk="$1" kode="$2" nama="$3" catatan="$4" berkas perintah

  say "Mengirim APK ke $HOST…"
  ssh -o ConnectTimeout=15 "$HOST" "mkdir -p $(printf '%q' "$SERVER_DIR/incoming")"
  berkas="$SERVER_DIR/incoming/rilis-$kode.apk"
  rsync -az "$apk" "$HOST:$berkas"

  say "Menerbitkan rilis di container server…"

  # Nilainya dikirim sebagai argumen yang sudah dikutip: `ssh` menggabungkan
  # argumennya menjadi satu baris perintah, sehingga catatan rilis yang berisi
  # spasi atau kurung akan merusak perintah kalau dikutip sendiri-sendiri.
  perintah="bash -s -- $(printf '%q' "$SERVER_DIR") $(printf '%q' "$kode") $(printf '%q' "$nama") $(printf '%q' "$catatan")"

  ssh "$HOST" "$perintah" <<'REMOTE'
set -euo pipefail

berkas="$1/incoming/rilis-$2.apk"
cd "$1/backend"
docker compose cp "$berkas" "app:/tmp/rilis-$2.apk"
docker compose exec -T app php artisan release:publish "/tmp/rilis-$2.apk" \
  --version-code="$2" --version-name="$3" --notes="$4"
docker compose exec -T app rm -f "/tmp/rilis-$2.apk"
REMOTE
}

# Rilis dengan versionCode yang tidak naik tidak akan pernah ditawarkan ke
# aplikasi yang sudah terpasang, jadi lebih baik berhenti di sini.
if ((terbitkan == 1)); then
  if [[ "$tujuan" == "server" ]]; then
    command -v ssh >/dev/null || die "ssh tidak ada di PATH (dibutuhkan untuk menerbitkan ke $HOST)."
    command -v rsync >/dev/null || die "rsync tidak ada di PATH (dibutuhkan untuk menerbitkan ke $HOST)."

    terbit="$(kode_terbit_server)" || true
    if [[ -z "$terbit" ]]; then
      die "Tidak bisa membaca versi yang sudah terbit di $HOST:$SERVER_DIR.
  Pastikan container di server jalan (scripts/deploy-server.sh), atau terbitkan
  ke backend lokal dengan --lokal."
    fi
  else
    terbit="$(kode_terbit_lokal)" || terbit=""
    terbit="${terbit:-0}"
  fi

  if ((kode_baru <= terbit)) && ((paksa == 0)); then
    die "versionCode $kode_baru tidak lebih baru dari yang sudah terbit ($terbit).
  Aplikasi yang terpasang tidak akan ditawari versi ini. Pakai --naik atau --paksa."
  fi
fi

say "Versi   : $nama_lama ($kode_lama)  →  $nama_baru ($kode_baru)"
say "Build   : $mode"
say "JDK     : $JAVA_HOME"
say "Catatan : ${catatan:-(kosong)}"

# --- Naikkan versi --------------------------------------------------------

sed -i "s/versionCode[[:space:]]\+[0-9]\+/versionCode $kode_baru/" "$GRADLE"
sed -i "s/versionName[[:space:]]\"[^\"]*\"/versionName \"$nama_baru\"/" "$GRADLE"
grep -q "versionCode $kode_baru" "$GRADLE" || die "Gagal menulis versionCode ke $GRADLE"
ok "build.gradle: versionCode $kode_baru, versionName \"$nama_baru\""

# --- Build ----------------------------------------------------------------

say "Build web (vite)…"
(cd "$ROOT/mobile" && npm run build)

if [[ "$mode" == "release" ]]; then
  # Rilis tidak boleh membawa HTTP diizinkan (allowMixedContent), itu khusus debug.
  (cd "$ROOT/mobile" && npx cap sync android)
  gradle_task="assembleRelease"
  apk_rel="app/build/outputs/apk/release/app-release.apk"
else
  (cd "$ROOT/mobile" && npm run sync:lan)
  gradle_task="assembleDebug"
  apk_rel="app/build/outputs/apk/debug/app-debug.apk"
fi

say "Build APK ($gradle_task)…"
(cd "$ROOT/mobile/android" && ./gradlew "$gradle_task" --console=plain)

apk_src="$ROOT/mobile/android/$apk_rel"
if [[ ! -f "$apk_src" ]]; then
  # Rilis tanpa keystore menghasilkan *-unsigned.apk; nama berkasnya berbeda.
  apk_src="$(ls -1 "$ROOT/mobile/android/app/build/outputs/apk/$mode/"*.apk 2>/dev/null | head -1 || true)"
fi
[[ -f "$apk_src" ]] || die "APK hasil build tidak ditemukan."
case "$apk_src" in
  *unsigned.apk) die "APK release belum ditandatangani ($apk_src). Ikuti docs/RELEASE-ANDROID.md §4." ;;
esac

apk_out="$HOME/Downloads/warung-pos-$mode.apk"
mkdir -p "$(dirname "$apk_out")"
cp "$apk_src" "$apk_out"
ok "APK: $apk_out ($(du -h "$apk_out" | cut -f1))"

# --- Terbitkan ------------------------------------------------------------

if ((terbitkan == 1)); then
  if [[ "$tujuan" == "server" ]]; then
    terbitkan_ke_server "$apk_out" "$kode_baru" "$nama_baru" "$catatan"
  else
    say "Terbitkan ke backend lokal…"
    (cd "$BACKEND" && php artisan release:publish "$apk_out" --notes="$catatan")
  fi

  ok "Rilis $nama_baru (versionCode $kode_baru) sudah terbit."
else
  warn "Dilewati: APK tidak diterbitkan (--tanpa-terbit)."
fi

if [[ "$tujuan" == "server" ]]; then
  tujuan_teks="container di $HOST"
else
  tujuan_teks="backend lokal (php artisan serve) di mesin ini"
fi

cat <<TXT

Langkah setelah ini:
  1. Commit kenaikan versi:
       git add mobile/android/app/build.gradle
       git commit -m "chore(rilis): $nama_baru ($kode_baru)"
  2. Pastikan $tujuan_teks jalan dan terjangkau dari HP.
  3. Buka aplikasi di HP → lonceng di Beranda bertanda; halaman Notifikasi
     memuat "Versi $nama_baru tersedia".
TXT
