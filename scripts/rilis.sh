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
      → build APK → terbitkan ke backend, sehingga setiap aplikasi yang sudah
      terpasang ditawari pembaruan ini saat dibuka.

Opsi:
  -c, --catatan "..."   Catatan rilis yang tampil di aplikasi.
      --versi X.Y.Z     Set versionName (default: angka terakhir dinaikkan).
      --naik N          Tambah versionCode sebanyak N (default 1).
      --release         Build APK release bertanda tangan (butuh keystore).
      --tanpa-terbit    Hanya build APK, jangan diterbitkan ke backend.
      --paksa           Izinkan versionCode yang tidak lebih baru dari rilis terbit.
  -h, --help            Tampilkan bantuan ini.
TXT
}

catatan=""
versi=""
naik=1
mode="debug"
paksa=0
terbitkan=1

while (( $# > 0 )); do
  case "$1" in
    -c | --catatan) catatan="${2:?--catatan butuh nilai}"; shift 2 ;;
    --versi) versi="${2:?--versi butuh nilai}"; shift 2 ;;
    --naik) naik="${2:?--naik butuh nilai}"; shift 2 ;;
    --release) mode="release"; shift ;;
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

# Rilis dengan versionCode yang tidak naik tidak akan pernah ditawarkan ke
# aplikasi yang sudah terpasang, jadi lebih baik berhenti di sini.
if ((terbitkan == 1)); then
  terbit="$(cd "$BACKEND" && php artisan tinker \
    --execute="echo (int) (App\Models\AppRelease::query()->max('version_code') ?? 0);" \
    2>/dev/null | tr -dc '0-9')" || terbit=""
  terbit="${terbit:-0}"

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
  say "Terbitkan ke backend…"
  (cd "$BACKEND" && php artisan release:publish "$apk_out" --notes="$catatan")
  ok "Rilis $nama_baru (versionCode $kode_baru) sudah terbit."
else
  warn "Dilewati: APK tidak diterbitkan ke backend (--tanpa-terbit)."
fi

cat <<TXT

Langkah setelah ini:
  1. Commit kenaikan versi:
       git add mobile/android/app/build.gradle
       git commit -m "chore(rilis): $nama_baru ($kode_baru)"
  2. Pastikan backend jalan supaya HP bisa memeriksa versi:
       cd backend && php artisan serve --host=0.0.0.0 --port=8000
  3. Buka aplikasi di HP → Beranda menampilkan "Versi $nama_baru tersedia".
TXT
