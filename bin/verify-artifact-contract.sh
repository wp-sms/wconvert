#!/usr/bin/env bash
#
# verify-artifact-contract.sh — the free contract, proven at the artifact.
#
# The THIRD of ADR 0029's three programs, and the last to land, because "each
# half lands with the thing it inspects; nothing is written before its
# subject" — there was no release build to call it from until now.
#
#   ./bin/verify-artifact-contract.sh <staged-tree>
#
# Called from the release build, once per artifact, on the staged tree that is
# about to become a ZIP. It asserts what a build can get wrong and the source
# cannot (ADR 0029, checks c and d):
#
#   (c) The free artifact contains NO PATH UNDER PRO'S PLUGIN DIRECTORY.
#   (d) The free artifact CONTAINS ITS UN-MINIFIED SOURCE TREE — which is what
#       makes the readme's source claim true by construction, and what makes
#       wp.org Guideline 4 compatible with Guideline 9. WSMS's .distignore
#       strips its /resources while its readme still says sources ship there;
#       that is the trap this deletes rather than inherits (ADR 0028).
#
# Exit 0 = clean. Exit 1 = a violation, OR the check could not look.
#
# IT FAILS CLOSED, and that is not a detail. A check that cannot inspect what
# it was asked to inspect FAILS, because "couldn't look" reading as "clean" is
# how a leak ships the one time a BUILD is incomplete — and an incomplete build
# is precisely the state this program exists to be pointed at. A staged tree
# with no PHP in it, no bundle in it, or no sources in it is not a clean tree;
# it is a tree nothing was proven about.
#
# NO FLAGS, EVER (ADR 0029). It is a third program rather than a --artifact
# flag on verify-source-contract.sh for the reason that ADR gives: "the moment
# a check has an opt-out, the opt-out is what runs on the day it matters."
#
# AND IT IS NOT TOLD WHICH PLUGIN IT IS LOOKING AT. Both release runs invoke
# this same script (ADR 0030), and a --free/--pro switch would be the same
# opt-out one level down: point it at a Pro tree with --free and the leak scan
# runs against the wrong tier and passes. The tree answers instead — see
# bin/plugin-identity.php.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# fail(), pass(), find_matches(), require_populated_dir(), run_scan(),
# collect_root_php(), shared with bin/verify-source-contract.sh.
#
# A SHARED LIBRARY IS NOT A SHARED ENTRY POINT, and ADR 0029's "three programs,
# no flags" is about the second. bin/pro-scan-support.php says so for the two
# PHP scanners; the same holds here, and `run_scan` had already been copied
# between the two shell programs verbatim — comment and all — which is exactly
# the drift that file warns about.
# shellcheck source=bin/contract-support.sh
. "$SCRIPT_DIR/contract-support.sh"

# The failure count when the current section started, so a section can report
# its own verdict rather than the running total's — otherwise one failure in
# [2] silently suppresses the tick every later section earns.
SECTION_START=0

section() {
    SECTION_START="$FAILURES"
}

section_clean() {
    [ "$FAILURES" -eq "$SECTION_START" ]
}

verdict() {
    if [ "$FAILURES" -gt 0 ]; then
        echo "==> verify-artifact-contract FAILED with $FAILURES problem(s)." >&2
        exit 1
    fi
}

# --- Is there anything to inspect? -------------------------------------------
#
# Every branch here is a fail-closed one. None of them means "clean".

TREE="${1:-}"

if [ -z "$TREE" ]; then
    echo "usage: $0 <staged-tree>" >&2
    echo "==> verify-artifact-contract FAILED: no staged tree given — nothing was inspected." >&2
    exit 1
fi

TREE="${TREE%/}"

echo "==> verify-artifact-contract: $TREE"

if [ ! -d "$TREE" ] || [ ! -r "$TREE" ] || [ ! -x "$TREE" ]; then
    fail "staged tree is not a readable directory: $TREE — cannot verify"
    verdict
fi

# --- [0] WHICH PLUGIN IS THIS? -----------------------------------------------
#
# The tree says, by which plugin main file sits at its root. Zero is not a
# plugin; BOTH is one artifact carrying the other plugin inside it, which is
# the leak itself. Either way the answer is a failure, never a default.
IDENTITY=""

if ! IDENTITY="$(php "$SCRIPT_DIR/plugin-identity.php" "$TREE" 2>&1)"; then
    fail "cannot identify the staged tree — cannot verify"
    printf '%s\n' "$IDENTITY" | sed 's/^/        /' >&2
    verdict
fi

# Every value was escapeshellarg()'d by the emitter.
eval "$IDENTITY"

pass "identified as $slug ($tier)"

# --- [1] IS IT A PLUGIN AT ALL? ----------------------------------------------
#
# The floor beneath both contracts below. A scan of an empty tree finds no Pro
# path and no missing source, and reports both as clean.

require_file() {
    # $1 = path relative to the tree, $2 = why it must be there
    local rel="$1" why="$2"
    local path="$TREE/$rel"

    if [ ! -f "$path" ] || [ ! -r "$path" ]; then
        fail "$rel is missing or unreadable — $why"
        return 1
    fi

    if [ ! -s "$path" ]; then
        fail "$rel is empty — $why"
        return 1
    fi

    return 0
}

require_file() {
    # $1 = path relative to the tree, $2 = why it must be there
    local rel="$1" why="$2"
    local path="$TREE/$rel"

    if [ ! -f "$path" ] || [ ! -r "$path" ]; then
        fail "$rel is missing or unreadable — $why"
        return 1
    fi

    if [ ! -s "$path" ]; then
        fail "$rel is empty — $why"
        return 1
    fi

    return 0
}

require_file "$main_file" "a plugin directory without its main file is not a plugin" || true
require_populated_dir "$TREE" src '*.php' "this artifact ships no PHP" || true

# THE LOADER, BOTH TIERS. Pro's is not optional and not cosmetic: Pro dequeues
# free's loader and enqueues its own (ADR 0014), so a Pro ZIP missing this file
# leaves every page with no loader at all — "the same silent, total loss of
# function 0004 exists to prevent, arriving through a missing file".
require_file public/loader/loader.js "the shipped loader is built, never committed — run the build" || true

# THE ELIGIBILITY INSPECTOR, BOTH TIERS, AND PRO'S IS NOT OPTIONAL EITHER.
# Pro dequeues free's inspector and enqueues its own for the same reason it
# does with the loader (ADR 0014, ADR 0048) — and a Pro ZIP missing this file
# is worse than one missing the panel entirely: free's inspector has no
# `exit_intent` module, so it would report every exit-intent Optin on the site
# as "it has no trigger this site can fire" while those Optins worked
# perfectly. A diagnostic that is confidently wrong is acted on.
#
# It is a separate directory from the loader rather than a second file beside
# it because both Vite builds set `emptyOutDir`, so a shared directory would
# leave whichever ran last as the only survivor.
require_file public/inspector/inspector.js "the eligibility inspector is built, never committed — run the build" || true

if [ "$tier" = "free" ]; then
    # Free's wconvert.php requires vendor/autoload.php and renders an admin
    # notice instead of booting when it is absent. It is also what check (c)
    # inspects below, so a tree without it is a tree that check cannot speak
    # for.
    require_file vendor/autoload.php "free's plugin file cannot boot without Composer's autoloader" || true
    # THE ADMIN, BOTH HALVES. #73 split the bundle: the entry is what the
    # screen loads, and the builder, the gallery, the settings panel and the
    # renderer are a chunk it `import()`s the moment a merchant opens the
    # builder. A ZIP carrying the entry and not the chunk boots, renders four
    # working screens, and fails only on the fifth — in the browser, with a 404
    # in a console nobody has open.
    #
    # Both names carry a content hash (`vite.config.admin.mjs`), which is why
    # these are patterns rather than paths; `WConvert\Assets\ViteHelper` globs
    # for the same two at enqueue time and renders a notice instead of a screen
    # if either is missing.
    require_matching_file "$TREE" public/admin 'main-*.js' "the admin bundle is built, never committed — run the build" || true
    require_matching_file "$TREE" public/admin 'builder-*.js' "the builder chunk is built, never committed — run the build" || true
    # THE BLOCK EDITOR'S BUNDLE, AND FREE ONLY — Pro has no block of its own.
    #
    # `inline` is the one Display Type that is not an overlay, so it is the one
    # that needs somewhere on the page to go, and the block is one of the two
    # things that puts it there. It is registered unconditionally
    # (WConvert\Frontend\InlineOptinBlock says why: an unregistered dynamic
    # block renders NOTHING, so refusing to register on a missing bundle takes
    # the Optin off every page that already carries the block). That is the
    # right call at runtime and it is exactly why the artifact has to be
    # checked here: a ZIP without this file registers a block the inserter
    # offers and the editor cannot draw, with a 404 in a console nobody has
    # open.
    #
    # Not hashed, unlike the two admin files: nothing imports it, so its name
    # has no module identity to keep stable and BuiltAsset's `?ver` is enough.
    require_file public/blocks/inline-optin.js "the block editor bundle is built, never committed — run the build" || true
    require_file "$readme" "the wp.org listing, and the source claim (d) makes true, live in it" || true
fi

verdict

# --- [2] NOTHING THAT MUST NEVER SHIP ----------------------------------------
#
# Two names, and deliberately only two. This is not a denylist of untidy
# things — `tests/` and `bin/` shipping is untidy and harmless, and wp.org
# Guideline compliance is Plugin Check's job, not this program's. These two are
# here because neither can ever legitimately appear inside a WordPress plugin
# and each makes the artifact catastrophically wrong rather than merely
# scruffy: `.git` publishes the whole private history of a private repo, and
# `node_modules` is hundreds of megabytes of build-time dependencies. Their
# presence also means the stage did not run, which invalidates everything
# below it.
section

for never in .git node_modules; do
    if find_matches "$TREE" -name "$never"; then
        fail "the staged tree contains $never — the stage did not strip it"
    elif [ "$?" -eq 2 ]; then
        fail "could not search the staged tree for $never — cannot verify"
    fi
done

if section_clean; then
    pass "no .git and no node_modules"
fi

# --- [3] (c) NO PATH UNDER PRO'S PLUGIN DIRECTORY ----------------------------
#
# THE LEAK HAS ONE DIRECTION, and this program says so rather than pretending
# to a symmetry it does not have. Pro IS the premium code (ADR 0015 —
# enforcement is by non-registration, and possession is the gate), so there is
# nothing for a Pro artifact to leak. What protects the Pro artifact from
# carrying free is [0]: a tree holding both main files fails identification.
#
# For free, the check is real and has three halves, because a Pro path can
# reach the free ZIP three ways:
#
#   1. Pro's TREE, un-stripped by the stage — `pro/` as this repo lays it out,
#      or `wconvert-pro/` as an installed WordPress does.
#   2. Pro's MAIN FILE, at any depth, which is the same tree arriving under a
#      name nobody chose.
#   3. A Pro REFERENCE in free's shipped PHP. This is the half the source
#      contract cannot cover on its own, because `vendor/` is GENERATED: the
#      Composer autoload map is written at build time, and an autoload entry
#      pointing at `pro/src` is a premium path inside the free artifact that
#      no source file ever contained. pro/src/autoload.php names this exact
#      risk as its first reason for existing.
section

if [ "$tier" = "free" ]; then
    for dir_name in $pro_dir_names; do
        if find_matches "$TREE" -type d -name "$dir_name"; then
            fail "the free artifact contains a $dir_name/ directory — that is Pro's tree"
        elif [ "$?" -eq 2 ]; then
            fail "could not search the free artifact for a $dir_name/ directory — cannot verify"
        fi
    done

    if find_matches "$TREE" -type f -name "$other_main_file"; then
        fail "the free artifact contains $other_main_file — that is Pro's plugin"
    elif [ "$?" -eq 2 ]; then
        fail "could not search the free artifact for $other_main_file — cannot verify"
    fi

    collect_root_php "$TREE"

    # vendor/composer/ ONLY, never vendor/ whole. The generated autoload maps
    # are the artifact-level risk and they all live there; the rest of vendor/
    # is third-party code whose own use of a `pro/` path would be a false
    # positive, and the fix for a false positive is always an exception —
    # the one thing this gate must not acquire (ADR 0029).
    # src/ AND resources/. `resources/playbooks/*.php` SHIPS IN THE FREE ZIP —
    # PlaybookLibrary reads it by path constant — so it is free's tree by ADR
    # 0029's own definition ("free's tree is src/, resources/, and the plugin
    # files at the tree root"), and a `require WCONVERT_DIR . 'pro/…'` in a
    # Playbook is a Pro path in the free artifact. Scanning only src/ left that
    # unwatched. bin/pro-php-scan.php skips anything that is not PHP, so
    # pointing it at resources/ costs the walk and nothing else.
    SCAN_PATHS=("$TREE/src" "$TREE/resources")

    if [ -d "$TREE/vendor/composer" ]; then
        SCAN_PATHS+=("$TREE/vendor/composer")
    else
        fail "vendor/composer/ is missing — the autoload map was not inspected"
    fi

    run_scan "$SCRIPT_DIR" pro-php-scan.php \
        "the free artifact's PHP references Pro (namespace, or a pro/ path):" \
        "${SCAN_PATHS[@]}" ${ROOT_PHP[@]+"${ROOT_PHP[@]}"}

    if section_clean; then
        pass "no path under Pro's plugin directory"
    fi
else
    echo "  ! (c) asserted nothing: Pro IS the premium code, so a Pro artifact has no Pro to leak."
    echo "    What keeps free out of it is identification above — a tree holding both main files fails."
fi

verdict

# --- [4] (d) THE UN-MINIFIED SOURCE TREE -------------------------------------
#
# FREE ONLY, and the asymmetry is the point rather than an omission. Guideline
# 4 is a wp.org obligation and Pro is not distributed there — but more than
# that, "its un-minified source tree" is not a property Pro's DIRECTORY has:
# Pro's loader entry imports free's modules through `@loader/*` (ADR 0028), so
# Pro's sources are free's plus its own, and free's half lives in the other
# plugin. Asserting (d) against pro/resources/ would assert something that is
# not true of it.
#
# `resources/` is checked here for BOTH of its jobs at once, which is what
# keeps this list from being arbitrary. It is the un-minified source Guideline
# 4 requires published, AND it is runtime data `src/` reads by a path constant.
# Each entry below names the constant it answers to.
section

if [ "$tier" = "free" ]; then
    # The sources behind the two shipped bundles, plus the renderer both of
    # them import (vite.config.admin.mjs aliases @renderer at it).
    require_populated_dir "$TREE" resources/loader/src '*.ts' "public/loader/loader.js is built from it" || true
    require_populated_dir "$TREE" resources/admin/src '*.tsx' "public/admin/main-*.js is built from it" || true
    require_populated_dir "$TREE" resources/renderer/src '*.ts' "both bundles import it" || true
    require_populated_dir "$TREE" resources/blocks/inline-optin/src '*.tsx' "public/blocks/inline-optin.js is built from it" || true

    # Runtime data. Free reads each of these by a path constant, and a ZIP
    # missing one is a plugin that cannot draw a template or evaluate a rule.
    require_file resources/rules/manifest.json "WConvert\\Rules\\RuleManifest::PATH reads it" || true
    require_file resources/templates/manifest.json "WConvert\\Template\\TemplateManifest::PATH reads it" || true
    require_populated_dir "$TREE" resources/templates/library '*.json' "WConvert\\Template\\BundledTemplates::PATH reads it" || true
    require_file resources/templates/locked.json "WConvert\\Template\\LockedTemplates::PATH reads it" || true
    # The block's metadata, which is runtime data in the strictest sense:
    # WConvert\Frontend\InlineOptinBlock points register_block_type() at the
    # DIRECTORY, so WordPress reads this file on every request. It is also the
    # file the editor bundle imports its name from, which is what keeps the two
    # halves of the block from disagreeing about what it is called.
    require_file resources/blocks/inline-optin/block.json "WConvert\\Frontend\\InlineOptinBlock registers the block from it" || true
    require_populated_dir "$TREE" resources/playbooks '*.php' "WConvert\\Playbook\\PlaybookLibrary::PATH reads it" || true

    if section_clean; then
        pass "the un-minified source tree ships, and so does the data src/ reads"
    fi
else
    echo "  ! (d) asserted nothing: Pro's loader source is free's plus its own (ADR 0028),"
    echo "    so 'its un-minified source tree' is not a property of Pro's directory."
fi

verdict

# --- [5] (e) NO PREMIUM DESIGN IN THE FREE ZIP -------------------------------
#
# FREE ONLY, AND IT IS THE TRIALWARE GATE.
#
# Issue #7 states the rule this enforces: "if the free ZIP ships exit-intent
# code and refuses to run it, that is trialware". ADR 0015 answers it with
# enforcement-by-non-registration — a premium capability is ABSENT from a free
# install rather than present and guarded — and the design library is the
# newest place that rule can be broken, because a design is a JSON file that
# looks harmless in a diff.
#
# Two halves, and they fail differently:
#
#   1. A bundled entry declaring anything but `tier: free`. That is a premium
#      DESIGN in the free artifact, whatever the admin then does with it.
#   2. A `tree` anywhere in locked.json. That file exists precisely to carry
#      the CARD and not the design — a name, its facets and a link to a live
#      preview on wconvert.com — so a tree in it is the trialware shape
#      arriving through the file written to prevent it.
#
# Grepped rather than parsed, deliberately. A shell program that decoded JSON
# would need a decoder in the release environment, and what is being looked for
# is a literal key: `"tier": "pro"` cannot appear in a free entry for any
# reason, and neither can `"tree"` in locked.json.
section

if [ "$tier" = "free" ]; then
    if [ -d "$TREE/resources/templates/library" ]; then
        premium="$(grep -REl '"tier"[[:space:]]*:[[:space:]]*"pro"' "$TREE/resources/templates/library" 2>/dev/null || true)"

        if [ -n "$premium" ]; then
            fail "the free artifact bundles a premium design: $(echo "$premium" | tr '\n' ' ')"
        fi

        # An entry with no `tier` at all defaults to free and is fine; one
        # declaring a word that is neither is an entry nobody can classify, and
        # `Tier::tryFrom()` would silently read it as free.
        unknown="$(grep -REl '"tier"[[:space:]]*:[[:space:]]*"' "$TREE/resources/templates/library" 2>/dev/null \
            | while read -r entry; do
                grep -Eq '"tier"[[:space:]]*:[[:space:]]*"(free|pro)"' "$entry" || echo "$entry"
            done)"

        if [ -n "$unknown" ]; then
            fail "a bundled design declares a tier that is neither free nor pro: $(echo "$unknown" | tr '\n' ' ')"
        fi
    else
        fail "resources/templates/library/ is missing — the design library was not inspected"
    fi

    if [ -r "$TREE/resources/templates/locked.json" ]; then
        if grep -Eq '"tree"[[:space:]]*:' "$TREE/resources/templates/locked.json"; then
            fail "resources/templates/locked.json carries a tree — locked designs ship as metadata, never as designs"
        fi
    else
        fail "resources/templates/locked.json is missing — the locked metadata was not inspected"
    fi

    if section_clean; then
        pass "no premium design in the free artifact"
    fi
else
    echo "  ! (e) asserted nothing: Pro IS where the premium designs ship."
fi

verdict

echo "  ✓ artifact contract clean"
