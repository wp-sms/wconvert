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
#   (e) No premium design in the free ZIP — the trialware gate (issue #7).
#   (f) NO ARTIFACT CARRIES A HIGHER TIER'S MODULE, in PHP and in the built
#       JavaScript — by its rule identifiers where it has them, and by the
#       token it declares in its own module.json where it ships no rule type
#       at all (ADR 0056). WP Statistics proves this and WSMS does not:
#       all three of its premium tiers ship a byte-identical `main.js`, so a
#       Basic customer holds the Elite React UI behind a client-readable flag.
#       Under possession-gating that is not a weaker gate, it is no gate.
#   (g) The free artifact carries NO LICENSING SDK. A licence gates updates
#       and support and never a feature (ADR 0015), so the code that reads one
#       is Pro's alone — and free's ZIP is the one a review team reads.
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

# THE ADMIN BUNDLE, BOTH TIERS AND BOTH HALVES. Pro replaces free's admin
# bundle on the same rule it replaces the loader (ADR 0014 extended to the
# admin), so a Pro ZIP missing this shows the merchant free's admin screen
# instead of Pro's — which degrades correctly and silently, and is therefore
# exactly the failure nobody notices until a premium screen is missing.
#
# Both names carry a content hash (`vite.admin-config.mjs`), which is why these
# are patterns rather than paths; `WConvert\Assets\ViteHelper` globs for the
# same two at enqueue time, for either plugin, and degrades rather than
# rendering a blank screen if either is missing.
#
# Both halves, because #73 split the bundle: a ZIP carrying the entry and not
# the chunk boots, renders four working screens, and fails only on the fifth —
# in the browser, with a 404 in a console nobody has open.
require_matching_file "$TREE" public/admin 'main-*.js' "the admin bundle is built, never committed — run the build" || true
require_matching_file "$TREE" public/admin 'builder-*.js' "the builder chunk is built, never committed — run the build" || true

if [ "$tier" = "free" ]; then
    # Free's wconvert.php requires vendor/autoload.php and renders an admin
    # notice instead of booting when it is absent. It is also what check (c)
    # inspects below, so a tree without it is a tree that check cannot speak
    # for.
    require_file vendor/autoload.php "free's plugin file cannot boot without Composer's autoloader" || true
    # The ordinary inline block bundle belongs to Free.
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
else
    require_file public/blocks/content-lock.js "the content-region editor is built for every Pro tier" || true
    require_file public/blocks/content-lock.css "content-lock editor styles must load in the WordPress iframe" || true
    require_file modules/content-lock/static-blocks.json "the divider renderer reads the supported static block schema" || true
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
    # THE TIER LADDER, AND IT IS FREE'S FILE (ADR 0056). Free's admin renders
    # every upsell card's tier NAME from it and WConvert\Support\WpProPresence
    # infers the installed tier through it. ADR 0015 records WSMS's cautionary
    # case as its shipped elite ZIP missing exactly this file, benign only
    # because every lookup fails open — this is the line that stops the same
    # sentence being written about WConvert.
    require_file tiers.json "WConvert\\Support\\TierManifest::PATH reads it" || true
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

# The ladder is free's file and is not in Pro's ZIP, so it is read from the
# repository this program lives in unless the tree carries its own. The rule
# manifest is the same: both are facts about the PRODUCT rather than about the
# tree being inspected.
LADDER="$(dirname "$SCRIPT_DIR")/tiers.json"
RULES="$(dirname "$SCRIPT_DIR")/resources/rules/manifest.json"

if [ -r "$TREE/tiers.json" ]; then
    LADDER="$TREE/tiers.json"
fi

if [ ! -r "$LADDER" ] || [ ! -r "$RULES" ]; then
    fail "the tier ladder or the rule manifest could not be read — the tier checks inspected nothing"
    verdict
fi

# Every word a `tier` may be, as an alternation. Read from the ladder rather
# than written out, so a rung added to tiers.json is not a rung this program
# rejects as unclassifiable (ADR 0056).
PAID_TIERS=""
ALL_TIERS="free"

while IFS= read -r rung; do
    [ -n "$rung" ] || continue

    PAID_TIERS="${PAID_TIERS:+$PAID_TIERS|}$rung"
    ALL_TIERS="$ALL_TIERS|$rung"
done < <(php "$SCRIPT_DIR/tier-manifest.php" tiers "$LADDER")

if [ -z "$PAID_TIERS" ]; then
    fail "the tier ladder declares no paid tier — the design checks inspected nothing"
    verdict
fi

if [ "$tier" = "free" ]; then
    if [ -d "$TREE/resources/templates/library" ]; then
        # ANY paid rung, not the word "pro". The eight premium designs are the
        # `display-types` module's and are declared `basic` (ADR 0056), so a
        # check that still looked for `"tier": "pro"` would have gone on
        # printing a tick over a free ZIP full of premium designs.
        premium="$(grep -REl "\"tier\"[[:space:]]*:[[:space:]]*\"($PAID_TIERS)\"" "$TREE/resources/templates/library" 2>/dev/null || true)"

        if [ -n "$premium" ]; then
            fail "the free artifact bundles a premium design: $(echo "$premium" | tr '\n' ' ')"
        fi

        # An entry with no `tier` at all defaults to free and is fine; one
        # declaring a word the ladder does not carry is an entry nobody can
        # classify, and `Tier::tryFrom()` would silently read it as free.
        unknown="$(grep -REl '"tier"[[:space:]]*:[[:space:]]*"' "$TREE/resources/templates/library" 2>/dev/null \
            | while read -r entry; do
                grep -Eq "\"tier\"[[:space:]]*:[[:space:]]*\"($ALL_TIERS)\"" "$entry" || echo "$entry"
            done)"

        if [ -n "$unknown" ]; then
            fail "a bundled design declares a tier the ladder does not carry: $(echo "$unknown" | tr '\n' ' ')"
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
    # ------------------------------------------------------------------------
    # PRO'S HALF, WHICH IS THE SAME RULE READ FROM THE OTHER END.
    # ------------------------------------------------------------------------
    # This printed "asserted nothing" and it was right to, while Pro shipped no
    # designs at all. It ships five now, and "Pro IS where the premium designs
    # ship" is a claim with an artifact behind it — so it is asserted rather
    # than said.
    #
    # The failure it catches is not a leak, it is an EMPTY LIBRARY: Pro's
    # designs are the whole of what a customer bought a `floating_bar` for, and
    # a build that staged `resources/` without `pro/resources/` produces a ZIP
    # that installs, activates, replaces the loader and shows the customer the
    # same locked upsell cards free shows — with nothing anywhere saying why.
    # That is precisely the state this ticket found the product in.
    # A MODULE'S directory, not one fixed library path (ADR 0056). Pro's
    # designs belong to `display-types`, which every paid rung carries — so
    # this is asked of whatever modules the staged tier actually has, and a
    # rung that cut the wrong directory fails here rather than at a customer.
    #
    # Read one directory at a time, through a NUL-delimited read. A staged tree
    # lives wherever the checkout does, and an unquoted `$design_dirs` splits on
    # the space in a path like `.../Local Sites/...` — which greps two
    # directories that do not exist, finds nothing, and reports a complete Pro
    # build as one bundling no designs at all. Found the honest way: by this
    # program failing a correct ZIP.
    designs=""
    design_dirs=0

    while IFS= read -r -d '' design_dir; do
        design_dirs=$((design_dirs + 1))
        designs="$designs$(grep -REl "\"tier\"[[:space:]]*:[[:space:]]*\"($PAID_TIERS)\"" "$design_dir" 2>/dev/null || true)"
    done < <(find "$TREE/modules" -type d -name templates -print0 2>/dev/null)

    if [ "$design_dirs" -eq 0 ]; then
        fail "no modules/*/templates/ directory in Pro — the premium designs were not inspected"
    elif [ -z "$designs" ]; then
        fail "the Pro artifact bundles no premium design — Pro IS where they ship, so an empty library is a broken build"
    fi

    if section_clean; then
        pass "the premium designs ship in the Pro artifact"
    fi
fi

verdict

# --- [6] (f) NO ARTIFACT CARRIES A HIGHER TIER'S MODULE ----------------------
#
# THE TREE SAYS WHICH RUNG IT IS, exactly as it says which plugin it is. There
# is no --basic flag, for ADR 0029's reason one level down: pass --basic to an
# elite tree and the check runs against the wrong rung and passes. The rung is
# INFERRED from the module directories the build left behind — the same
# inference a running install makes (WConvert\Support\WpProPresence), so the
# ZIP and the install cannot disagree about what a build is.
#
# Free has no rung and asserts a different half: it must carry no module
# directory at all, which check (c) already covers by refusing any `pro/` tree.
# What is added here for free is that `public/tiers/` — repository scaffolding
# for the per-tier builds — never reaches an artifact of either kind.
section

# `$LADDER` and `$RULES` were resolved and proven readable in [5].

if find_matches "$TREE" -type d -name tiers -path '*/public/*'; then
    fail "the artifact contains public/tiers/ — that is per-tier build scaffolding and ships in nothing"
elif [ "$?" -eq 2 ]; then
    fail "could not search the artifact for public/tiers/ — cannot verify"
fi

if [ "$tier" = "pro" ] && section_clean; then
    RUNG=""

    if ! RUNG="$(php "$SCRIPT_DIR/tier-manifest.php" infer "$LADDER" "$TREE" 2>&1)"; then
        fail "cannot tell which tier this Pro artifact is — cannot verify"
        printf '%s\n' "$RUNG" | sed 's/^/        /' >&2
    else
        echo "  ✓ this Pro artifact is the $RUNG tier"

        # ---------------------------------------------------------------
        # THE PHP HALF: every module it ships is one this rung declares.
        #
        # A module is a directory, so a rung that shipped one it does not
        # declare would be a `rm -rf` that did not run — and the inference
        # above would have read that build as the HIGHER rung, which is the
        # failure this catches: the ZIP is then named `basic` and contains
        # `pro`. Checked against the declaration rather than against the
        # inference, so the two cannot agree by both being wrong.
        # ---------------------------------------------------------------
        DECLARED=""

        if ! DECLARED="$(php "$SCRIPT_DIR/tier-manifest.php" modules "$LADDER" "$RUNG" 2>&1)"; then
            fail "cannot read the $RUNG tier's module set — cannot verify"
        else
            for module_dir in "$TREE"/modules/*/; do
                [ -d "$module_dir" ] || continue

                module_slug="$(basename "$module_dir")"
                declared_here=""

                while IFS= read -r declared_module; do
                    [ "$declared_module" = "$module_slug" ] && declared_here="yes"
                done <<< "$DECLARED"

                if [ -z "$declared_here" ]; then
                    fail "the $RUNG artifact carries the $module_slug module, which $RUNG does not ship"
                fi
            done

            # AND EVERY MODULE IT DECLARES IS THERE. The mirror failure, and
            # the one a customer meets: a Basic ZIP missing `display-types`
            # installs, activates, replaces the loader, and shows the same
            # locked upsell cards free shows.
            while IFS= read -r declared_module; do
                [ -n "$declared_module" ] || continue

                if [ ! -f "$TREE/modules/$declared_module/module.json" ]; then
                    fail "the $RUNG artifact is missing the $declared_module module, which $RUNG ships"
                fi
            done <<< "$DECLARED"
        fi

        # ---------------------------------------------------------------
        # THE JAVASCRIPT HALF, AND IT IS THE ONE WSMS DOES NOT DO.
        #
        # Cutting a module directory removes its SOURCE. Whether it removed
        # the module from the shipped BUNDLE is a different question, and the
        # only honest way to ask it is of the bytes. `bin/check-loader.mjs`
        # asks the same question of the repository's builds on every pull
        # request; this asks it of the ZIP.
        # ---------------------------------------------------------------
        FORBIDDEN=""

        if ! FORBIDDEN="$(php "$SCRIPT_DIR/tier-manifest.php" identifiers "$LADDER" "$RUNG" "$RULES" 2>&1)"; then
            fail "cannot read which rule types sit above the $RUNG tier — cannot verify"
        elif [ -z "$FORBIDDEN" ]; then
            echo "  ! nothing is filed above $RUNG, so the bundle scan asserted nothing"
        else
            for built in public/loader/loader.js public/inspector/inspector.js; do
                if [ ! -r "$TREE/$built" ]; then
                    # [1] already failed on this; do not report it twice.
                    continue
                fi

                while IFS= read -r identifier; do
                    [ -n "$identifier" ] || continue

                    if grep -q -- "$identifier" "$TREE/$built"; then
                        fail "$built in the $RUNG artifact contains \"$identifier\", which is filed above $RUNG"
                    fi
                done <<< "$FORBIDDEN"
            done
        fi

        # ---------------------------------------------------------------
        # AND THE SAME QUESTION FOR A MODULE THAT SHIPS NO RULE TYPE.
        #
        # The scan above reads its list out of the RULE MANIFEST, so it can
        # only see a module whose contribution is a rule. `ab-testing`'s is a
        # payload narrowing, so a Basic ZIP carrying its whole arm-drawing
        # routine would pass every check above — the byte-identical failure
        # ADR 0056 measures WSMS by, reached through a gap in the scan rather
        # than through a flag.
        #
        # A module declares its own token in its own module.json, and the
        # markers are read from the REPOSITORY rather than from the staged
        # tree: the whole question is about a module the cut removed, so its
        # manifest is exactly what is no longer there to read.
        # ---------------------------------------------------------------
        MARKERS=""
        MODULES_DIR="$(dirname "$SCRIPT_DIR")/pro/modules"

        if [ ! -d "$MODULES_DIR" ]; then
            fail "cannot find the module manifests at $MODULES_DIR — cannot verify"
        elif ! MARKERS="$(php "$SCRIPT_DIR/tier-manifest.php" markers "$LADDER" "$RUNG" "$MODULES_DIR" 2>&1)"; then
            fail "cannot read which modules sit above the $RUNG tier — cannot verify"
        elif [ -z "$MARKERS" ]; then
            echo "  ! no module above $RUNG declares a marker, so the module scan asserted nothing"
        else
            # Named beside the tick, never folded into it. A module above this
            # rung that declares no marker is one nothing looked for, and a
            # reader has to be able to tell that from a rung with nothing above
            # it (ADR 0029).
            if UNMARKED="$(php "$SCRIPT_DIR/tier-manifest.php" unmarked "$LADDER" "$RUNG" "$MODULES_DIR" 2>/dev/null)" \
                && [ -n "$UNMARKED" ]; then
                echo "  ! $(echo "$UNMARKED" | tr '\n' ' ')declare no marker and were not scanned for"
            fi

            for built in public/loader/loader.js public/inspector/inspector.js; do
                if [ ! -r "$TREE/$built" ]; then
                    # [1] already failed on this; do not report it twice.
                    continue
                fi

                while IFS= read -r marker; do
                    [ -n "$marker" ] || continue

                    if grep -qF -- "$marker" "$TREE/$built"; then
                        fail "$built in the $RUNG artifact contains \"$marker\", a module filed above $RUNG"
                    fi
                done <<< "$MARKERS"
            done
        fi
    fi
fi

if section_clean; then
    pass "no artifact carries a higher tier's module, in PHP or in the bundle"
fi

verdict

# --- [7] (g) NO LICENSING SDK IN THE FREE ZIP --------------------------------
#
# FREE ONLY, and it is the artifact-level half of ADR 0015's line: "the licence
# option is read by Pro's updater and admin screens only, and never on a
# front-end request". The SDK is vendored into PRO builds through a Composer
# scoper profile, so free carrying it means the profile did not apply — and the
# free ZIP is the one a wp.org review team reads.
#
# It is checked at the ARTIFACT rather than at the source because `vendor/` is
# GENERATED: no source file in this repository ever names the package, so
# bin/verify-source-contract.sh cannot see it however hard it looks. That is the
# same argument check (c) makes about the Composer autoload map, in the same
# place, for the same reason.
section

if [ "$tier" = "free" ]; then
    for sdk_name in wp-premium-sdk WpPremiumSdk; do
        if find_matches "$TREE" -name "*${sdk_name}*"; then
            fail "the free artifact contains $sdk_name — the licensing SDK is Pro's alone"
        elif [ "$?" -eq 2 ]; then
            fail "could not search the free artifact for $sdk_name — cannot verify"
        fi
    done

    if section_clean; then
        pass "no licensing SDK in the free artifact"
    fi
else
    echo "  ! (g) asserted nothing: the licensing SDK is Pro's, so a Pro artifact is where it belongs."
fi

verdict

echo "  ✓ artifact contract clean"
