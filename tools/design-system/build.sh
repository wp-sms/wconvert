#!/usr/bin/env bash
#
# Regenerate the WConvert Admin design system from resources/admin/src.
#
#     ./build.sh                 # everything
#     ./build.sh tokens          # one step
#     ./build.sh screens sheet   # several
#
# ============================================================================
# WHY THIS IS A BUILD AND NOT A FOLDER OF FILES.
# ============================================================================
# The design system is a MIRROR of the admin, and a hand-maintained mirror is
# one that is wrong from the first commit nobody remembered to copy across. So
# nothing here is authored twice: the tokens are lifted out of `index.css`, the
# shell rules are selected out of it by selector, and the screen cards are the
# live DOM of a real WordPress with the plugin running.
#
# The two files that ARE authored — `GUIDELINES.md` and `BRIEF.md` — are prose
# about why, which no amount of reading the code produces. They sit beside this
# script and are copied in.
#
# ============================================================================
# THE GENERATOR IS IN THE REPO. ITS OUTPUT IS NOT.
# ============================================================================
# `out/` is gitignored and `docs/design-system/` deliberately does not exist:
# the durable half of this work is ADR 0060, which states the rules, and a
# picture that can be regenerated on demand does not need a home in version
# control.
#
# The SCRIPT is a different question, and it is here because the last copy was
# not. It lived in a session scratchpad, the scratchpad went, and rebuilding it
# cost a day — which is a bad trade for a directory the release strips anyway
# (`/tools` is in .distignore).
#
# No step depends on another's output except `sheet`, which needs `screens`.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export WCONVERT_PLUGIN="${WCONVERT_PLUGIN:-$(cd "$HERE/../.." && pwd)}"

if [[ ! -f "$WCONVERT_PLUGIN/resources/admin/src/index.css" ]]; then
  echo "WCONVERT_PLUGIN does not look like the plugin: $WCONVERT_PLUGIN" >&2
  echo "Set it explicitly: WCONVERT_PLUGIN=/path/to/wconvert ./build.sh" >&2
  exit 2
fi

STEPS=("$@")

if [[ ${#STEPS[@]} -eq 0 ]]; then
  STEPS=(assets tokens shell prose screens sheet)
fi

mkdir -p "$HERE/out/previews"

ran() { printf '\n\033[1m%s\033[0m\n' "$1"; }

for step in "${STEPS[@]}"; do
  case "$step" in
    assets)
      # The compiled stylesheet is what every card inlines, so a stale
      # `public/admin/main.css` is a bundle that shows the admin as it was two
      # commits ago — the one failure that produces no error anywhere.
      ran "Building the admin bundle"
      (cd "$WCONVERT_PLUGIN" && npm run build:admin)
      ;;

    tokens)
      ran "Lifting the token layer"
      node "$HERE/build/tokens.mjs"
      ;;

    shell)
      ran "Selecting the vocabulary CSS"
      node "$HERE/build/shell.mjs"
      ;;

    prose)
      ran "Copying the authored half"
      cp "$HERE/GUIDELINES.md" "$HERE/out/GUIDELINES.md"
      cp "$HERE/BRIEF.md" "$HERE/out/BRIEF.md"
      echo "  GUIDELINES.md, BRIEF.md"
      ;;

    screens)
      # Boots Playground, seeds a site, and captures every reading screen in
      # all four situations and both directions. ~3 minutes.
      ran "Capturing the screens"
      node "$HERE/build/capture-screens.mjs"
      ;;

    sheet)
      # The grid. Two screens disagreeing about the same situation is obvious
      # here and invisible in a diff of either card.
      ran "Building the contact sheets"
      node "$HERE/build/contact-sheet.mjs"
      ;;

    *)
      echo "unknown step: $step (assets tokens shell prose screens sheet)" >&2
      exit 2
      ;;
  esac
done

ran "Done"
echo "  $HERE/out"
