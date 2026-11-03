#!/usr/bin/env bash
#
# Compile the admin's translations for a local WordPress, outside the repository.
#
#     tools/admin-translations/compile.sh [output-dir]     default: $TMPDIR/wconvert-languages
#
# Writes:
#     <output-dir>/languages/plugins/   Free. Mount <output-dir>/languages as wp-content/languages
#     <output-dir>/pro/                 Pro. Mount over pro/resources/languages
#
# Free's .po never ships: wp.org's language pack is what reaches sites. Pro's ships,
# and bin/build.sh compiles it itself, so this is only for seeing a locale for real.
#
# Run it again after every `npm run build`. Each JS catalogue is named after the md5
# of the bundle it belongs to, and bundle names carry a content hash, so a catalogue
# from an earlier build is never asked for. Each .po is therefore brought up to a
# freshly made POT first, and only the copy in <output-dir> is changed. The POTs are
# rebuilt where `npm run build:pot*` writes them, which git ignores.

set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
out="${1:-${TMPDIR:-/tmp}/wconvert-languages}"
wp="$(command -v wp)" || { echo "✗ wp-cli not found" >&2; exit 2; }
run_wp() { php -d error_reporting=E_ERROR -d memory_limit=2G "$wp" i18n "$@" --quiet; }

compile() { # $1 = POT, $2 = destination, $3… = .po files
    local pot="$1" dest="$2"
    shift 2
    mkdir -p "$dest"
    rm -f "$dest"/*.po "$dest"/*.mo "$dest"/*.l10n.php "$dest"/*.json
    cp "$@" "$dest"/
    local po
    for po in "$dest"/*.po; do
        run_wp update-po "$pot" "$po"
    done
    run_wp make-mo "$dest"
    run_wp make-php "$dest"
    run_wp make-json "$dest" --no-purge
}

cd "$root"
ls public/admin/*.js pro/public/admin/*.js >/dev/null 2>&1 || { echo "✗ no built bundles: run npm run build first" >&2; exit 2; }

npm run --silent build:pot >/dev/null 2>&1
npm run --silent build:pot:pro >/dev/null 2>&1

compile dist/languages/wconvert.pot "$out/languages/plugins" tools/admin-translations/*.po
compile pro/resources/languages/wconvert-pro.pot "$out/pro" pro/resources/languages/*.po

echo "✓ $out"
ls "$out/languages/plugins" | sed 's/-[0-9a-f]\{32\}\.json$/-*.json/' | sort | uniq -c
ls "$out/pro" | sed 's/-[0-9a-f]\{32\}\.json$/-*.json/' | sort | uniq -c
