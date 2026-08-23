#!/bin/zsh
# Runs every pass and writes the raw output into results/. FINDINGS.md quotes these.
set -e
cd "$(dirname "$0")"
: ${WCV_WP:=/private/tmp/claude-501/-Users-navidkashani-Local-Sites-wconvert-app-public-wp-content-plugins-wconvert/864f57f9-ba41-48b9-9b3c-551bfa5e5930/scratchpad/wpc}
export WCV_WP
mkdir -p ../results

echo "== sizes"
(cd .. && ./build.sh) > ../results/00-sizes.txt 2>/dev/null

$WCV_WP site switch-language en_US >/dev/null 2>&1 || true

for pass in matrix-themes matrix-hostile fixed-positioning z-index-war a11y a11y-free focus-restore clip; do
  echo "== $pass"
  node "$pass.mjs" > "../results/$pass.txt" 2>/dev/null
done

echo "== rtl (real fa_IR locale)"
$WCV_WP site switch-language fa_IR >/dev/null 2>&1
node rtl.mjs > ../results/rtl.txt 2>/dev/null
$WCV_WP site switch-language en_US >/dev/null 2>&1

echo "done -> results/"
