#!/usr/bin/env bash
#
# Regenerate the design-library working set from resources/templates.
#
#     ./build.sh                    # everything
#     ./build.sh vocabulary         # one step
#     ./build.sh renderer designs sheet
#
# ============================================================================
# A SIBLING OF tools/design-system, NOT A STEP INSIDE IT.
# ============================================================================
# Same machinery, different subject. That one mirrors the **wp-admin screens**
# and needs a booted WordPress to do it; this one mirrors the **visitor-facing
# designs**, and the renderer is dependency-free — so there is no Playground,
# no seed, no `rest_pre_dispatch` harness and none of that README's wp-admin
# traps. What is shared is the contact-sheet tiler, which is imported from
# there rather than copied.
#
# ============================================================================
# NOTHING HERE IS AUTHORED TWICE.
# ============================================================================
# `VOCABULARY.md` is generated from `resources/templates/manifest.json`, the
# renderer bundle is built from `resources/renderer/src`, and the cards are the
# real library rendered by the real renderer. The three files that ARE authored
# — `BRIEF.md`, `GUIDELINES.md` and this script — are prose about why, which no
# amount of reading the code produces.
#
# The one mirror is `build/containers.mjs`, because the shipping containers are
# built imperatively and there is no stylesheet to lift. It asserts itself
# against their source and throws when they move.
#
# ============================================================================
# THE GENERATOR IS IN THE REPO. ITS OUTPUT IS NOT.
# ============================================================================
# `out/` is gitignored, and `/tools` is in `.distignore` so none of this ships
# in either ZIP. The script is here because the last one like it lived in a
# session scratchpad, the scratchpad went, and rebuilding it cost a day.
#
# `designs`, `bench`, `gallery` and both reviews need `renderer`; `sheet` needs `designs`.
# Nothing else depends on anything.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export WCONVERT_PLUGIN="${WCONVERT_PLUGIN:-$(cd "$HERE/../.." && pwd)}"

if [[ ! -f "$WCONVERT_PLUGIN/resources/templates/manifest.json" ]]; then
  echo "WCONVERT_PLUGIN does not look like the plugin: $WCONVERT_PLUGIN" >&2
  echo "Set it explicitly: WCONVERT_PLUGIN=/path/to/wconvert ./build.sh" >&2
  exit 2
fi

STEPS=("$@")

if [[ ${#STEPS[@]} -eq 0 ]]; then
  STEPS=(vocabulary prose renderer designs sheet bench gallery review library-review pilot proof roadmap)
fi

mkdir -p "$HERE/out/previews"

ran() { printf '\n\033[1m%s\033[0m\n' "$1"; }

for step in "${STEPS[@]}"; do
  case "$step" in
    vocabulary)
      # The portable spec — the file you paste into a system that has never
      # seen this repo. Generated, so it cannot drift, so there is no parity
      # test to write and none to forget.
      ran "Generating the vocabulary spec"
      node "$HERE/build/vocabulary.mjs"
      ;;

    prose)
      ran "Copying the authored half"
      cp "$HERE/BRIEF.md" "$HERE/out/BRIEF.md"
      cp "$HERE/GUIDELINES.md" "$HERE/out/GUIDELINES.md"
      echo "  BRIEF.md, GUIDELINES.md"
      ;;

    renderer)
      # The shipping renderer as an IIFE. A stale bundle draws the library as
      # it looked two commits ago, which is the one failure that produces no
      # error anywhere — the same reason design-system rebuilds the admin
      # bundle before capturing it.
      ran "Bundling the renderer"
      node "$HERE/build/renderer.mjs"
      ;;

    designs)
      # Every design, every step, both directions. No browser: this only
      # writes HTML.
      ran "Capturing the designs"
      node "$HERE/build/capture-designs.mjs"
      ;;

    sheet)
      # The grid. "Are these forty designs, or one design forty times?" is
      # obvious here and unanswerable anywhere else.
      ran "Building the contact sheets"
      node "$HERE/build/contact-sheet.mjs"
      ;;

    bench)
      # The return path — a design comes BACK through this. Needs `renderer`.
      ran "Building the Design Bench"
      node "$HERE/build/bench.mjs"
      ;;

    gallery)
      # The whole library on one page, and the only one of the three views
      # that is a link you can send someone. Needs `renderer`.
      ran "Building the gallery"
      node "$HERE/build/gallery.mjs"
      ;;

    review)
      ran "Building the flagship review"
      node "$HERE/build/flagship-review.mjs"
      ;;

    library-review)
      ran "Building the full-library review"
      node "$HERE/build/library-review.mjs"
      ;;

    starting-points)
      ran "Building the twelve starting points"
      node "$HERE/build/starting-points.mjs"
      ;;

    pilot)
      ran "Building the campaign pilot and similarity inventory"
      node "$HERE/build/pilot.mjs"
      ;;

    proof)
      ran "Building paired desktop and phone screen proofs"
      node "$HERE/build/proof.mjs"
      ;;

    roadmap)
      ran "Building the visual audit and next-batch reference board"
      node "$HERE/build/roadmap.mjs"
      ;;

    *)
      echo "unknown step: $step (vocabulary prose renderer designs sheet bench gallery review library-review starting-points pilot proof roadmap)" >&2
      exit 2
      ;;
  esac
done

ran "Done"
echo "  $HERE/out"
