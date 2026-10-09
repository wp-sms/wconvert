#!/usr/bin/env bash
#
# build.sh — the release build. Two plugins, one monorepo.
#
#   ./bin/build.sh free     → dist/wconvert-v{VER}.zip
#   ./bin/build.sh pro      → dist/wconvert-pro-{TIER}-v{VER}.zip, one per tier
#   ./bin/build.sh all      → both
#
# Each artifact is a self-contained, installable WordPress plugin ZIP with a
# single top-level directory named for its install slug. Free and Pro are
# SEPARATE PLUGINS installed alongside each other (ADR 0014), not two builds of
# one — so there is nothing to strip out of free. Staging is a copy, a
# .distignore, and a zip.
#
# ============================================================================
# PRO IS BUILT ONCE PER TIER, AND ALL THREE ARE BUILT EVEN THOUGH ONE SHIPS.
# ============================================================================
# The ladder is `tiers.json` (ADR 0056). A tier's ZIP is the full Pro tree with
# the module directories that tier does not ship DELETED — a module is a
# directory, so cutting one is a `rm -rf` rather than a list of paths somebody
# maintains and a set of `@build-strip` markers somebody remembers.
#
# **Every rung is built on every release run**, and only the top one is sold
# today. Machinery that is not exercised rots: a per-tier build that ran once a
# year would be discovered broken by the release that first needed it, which is
# the release nobody can wait for. Three ZIPs cost seconds.
#
# The top-level DIRECTORY inside every Pro ZIP is `wconvert-pro`, at every
# rung — they are one plugin at three tiers, and a customer moving up must
# replace their install rather than acquire a second one beside it. Only the
# ZIP's own name carries the tier, which is what Nexus matches a licence
# against.
#
# ============================================================================
# IT DOES NOT RUN THE JS BUILD, AND THAT IS ON PURPOSE.
# ============================================================================
# `public/` and `pro/public/` are gitignored, so a CLEAN CI CHECKOUT HAS
# NEITHER — which is how staleness is deleted rather than detected (ADR 0029).
# The workflow runs `npm ci && npm run build` before this script, and if it
# ever stops doing so, bin/verify-artifact-contract.sh fails closed on the
# missing bundle rather than shipping a plugin with no loader in it. A build
# script that rebuilt "just in case" would turn that hard failure into a
# silent success on whatever happened to be lying around.
#
# It DOES run Composer, inside the stage, because that is the opposite case:
# the developer's own vendor/ has dev dependencies in it and the artifact's
# must not, and "did you remember --no-dev" is not a thing to remember.
#
# ============================================================================
# THE CONTRACT RUNS BEFORE THE ZIP, NOT AFTER.
# ============================================================================
# bin/verify-artifact-contract.sh is invoked on each staged tree while it is
# still a tree, which is WSMS's exact slot for the same call. A ZIP that
# exists is a ZIP somebody can upload; the check has to be what decides
# whether one is written.
#
# Requirements: php, zip, and — for free — composer.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
DIST="$REPO_ROOT/dist"
STAGE_ROOT="$DIST/stage"

usage() {
    echo "usage: $0 <free|pro|all>" >&2
    exit 1
}

TARGET="${1:-}"

case "$TARGET" in
    free|pro|all) ;;
    *) usage ;;
esac

# Collection approvals are bound to the actual renderer and prepared setups.
# Rebuild this metadata before staging; stale reviews must not ship merely
# because yesterday's generated JSON still exists. This does not rebuild the
# production assets or publish a collection, and introduces no CI workflow.
(cd "$REPO_ROOT" && npm run templates:collections:check)

for tool in php zip; do
    command -v "$tool" >/dev/null 2>&1 || {
        echo "required command not found: $tool" >&2
        exit 1
    }
done

# ---------------------------------------------------------------------------
# .distignore, applied to a STAGE and never to the tree it was copied from.
#
# Two forms, the same two WSMS's build understands:
#
#   /anchored/path   removed from the root of the stage, and only from there
#   bare-name        removed wherever it appears, at any depth
#
# Anchored is the default in both .distignore files here, because a bare name
# removes more than it looks like it does — `README.md` unanchored takes
# resources/playbooks/README.md with it.
# ---------------------------------------------------------------------------
apply_distignore() {
    local stage="$1" rules="$2"
    local line trimmed
    local -a paths=() names=()

    if [ ! -f "$rules" ]; then
        echo "  ✗ $rules not found — the stage was not stripped" >&2
        return 1
    fi

    while IFS= read -r line || [ -n "$line" ]; do
        trimmed="${line%%#*}"
        trimmed="${trimmed#"${trimmed%%[![:space:]]*}"}"
        trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
        [ -z "$trimmed" ] && continue

        if [[ "$trimmed" == /* ]]; then
            paths+=("$trimmed")
        else
            names+=("$trimmed")
        fi
    done < "$rules"

    local p
    for p in ${paths[@]+"${paths[@]}"}; do
        rm -rf "${stage}${p}"
    done

    if [ "${#names[@]}" -gt 0 ]; then
        local -a find_args=()
        local n
        for n in "${names[@]}"; do
            find_args+=(-name "$n" -o)
        done
        unset 'find_args[${#find_args[@]}-1]'
        find "$stage" \( "${find_args[@]}" \) -prune -exec rm -rf {} + 2>/dev/null || true
    fi
}

# ---------------------------------------------------------------------------
# Cut a staged Pro tree down to one tier.
#
# $1 = the stage, $2 = the tier slug.
#
# THREE DELETIONS AND A MOVE, AND THE ORDER MATTERS:
#
#   1. Every module directory the tier does not ship. The module's PHP, its
#      loader source and its designs all go together, because they are all
#      inside it — which is the whole reason a module is a directory.
#   2. The tier's own built bundles are moved into `public/loader/` and
#      `public/inspector/`, where an installed plugin looks for them. One path
#      per plugin directory: a plugin holding one build must not be asked at
#      enqueue time which tier it is (ADR 0015, ADR 0004).
#   3. `public/tiers/` itself, which is repository scaffolding and ships in
#      nothing. Leaving it would put every OTHER tier's bundle inside this
#      tier's ZIP — the byte-identical-JavaScript failure this whole split
#      exists to avoid, arriving through the build instead of through a flag.
# ---------------------------------------------------------------------------
cut_to_tier() {
    local stage="$1" tier="$2"
    local modules keep module slug bundle

    modules="$(php "$SCRIPT_DIR/tier-manifest.php" modules "$REPO_ROOT/tiers.json" "$tier")"

    if [ "$modules" = "*" ]; then
        echo "  · $tier ships every module"
    else
        for module in "$stage"/modules/*/; do
            [ -d "$module" ] || continue

            slug="$(basename "$module")"
            keep=""

            while IFS= read -r wanted; do
                [ "$wanted" = "$slug" ] && keep="yes"
            done <<< "$modules"

            if [ -z "$keep" ]; then
                echo "  · $tier withholds the $slug module"
                rm -rf "$module"
            fi
        done
    fi

    # The tier's own bundles into the one path the plugin reads. `elite` is
    # already there — vite.config.pro-tier.mjs writes the top rung to the
    # canonical path so a source checkout runs the whole product.
    if [ "$tier" != "elite" ]; then
        for bundle in loader inspector; do
            rm -rf "${stage:?}/public/${bundle}"

            if [ ! -d "$stage/public/tiers/$tier/$bundle" ]; then
                echo "  ✗ $tier has no built $bundle — run npm run build" >&2
                return 1
            fi

            mv "$stage/public/tiers/$tier/$bundle" "$stage/public/$bundle"
        done
    fi

    rm -rf "${stage:?}/public/tiers"
}

# ---------------------------------------------------------------------------
# One artifact.
#
# $1 = the source tree to stage from, relative to the repo root ('.' or 'pro')
# $2 = the tier slug, for Pro only. Empty for free, which has no ladder.
# ---------------------------------------------------------------------------
build_one() {
    local source_rel="$1"
    local tier_slug="${2:-}"
    local source="$REPO_ROOT"
    [ "$source_rel" = "." ] || source="$REPO_ROOT/$source_rel"

    # The tree says which plugin it is, what it is called and what version it
    # is. No argument here decides any of those — see bin/plugin-identity.php.
    local identity
    identity="$(php "$SCRIPT_DIR/plugin-identity.php" "$source")"

    # Declared local before the eval so the emitter's whole record stays inside
    # this call rather than leaking into the next one — `all` builds twice.
    local tier slug main_file tag_prefix version_constant
    local constants_file readme other_main_file pro_dir_names
    eval "$identity"

    # The version, through the one reader of the `Version:` header that this
    # repository has — the same function bin/check-release-tag.php compares the
    # tag against, so the guard and the build cannot disagree about what
    # version a tree is. It throws rather than guessing, and `set -e` makes
    # that a stopped build.
    local version
    version="$(php -r '
        require $argv[1] . "/plugin-identity.php";

        try {
            echo wconvertHeaderVersion($argv[2] . "/" . $argv[3], $argv[3]);
        } catch (RuntimeException $failure) {
            fwrite(STDERR, $failure->getMessage() . "\n");
            exit(1);
        }
    ' "$SCRIPT_DIR" "$source" "$main_file")"

    # One stage per tier, each holding a directory called `wconvert-pro` —
    # the ZIP's top-level name is the install slug at every rung, and only the
    # ZIP's own file name says which tier it is.
    local stage="$STAGE_ROOT/${tier_slug:-plain}/$slug"
    local zip_path="$DIST/${slug}-v${version}.zip"

    if [ -n "$tier_slug" ]; then
        zip_path="$DIST/${slug}-${tier_slug}-v${version}.zip"
        echo "==> build: $slug $version, $tier_slug tier (from ${source_rel}/)"
    else
        echo "==> build: $slug $version (from ${source_rel}/)"
    fi

    rm -rf "$stage"
    mkdir -p "$stage"

    # The four exclusions here are about COPY TIME, not about the contract:
    # each is either enormous or regenerated below, and each is named in the
    # .distignore too, so the artifact's contents are stated in one place and
    # this is only about not copying half a gigabyte to delete it a second
    # later. `public/` is deliberately NOT excluded — the built bundles are
    # the one gitignored thing that ships.
    tar -c -f - -C "$source" \
        --exclude './.git' \
        --exclude './node_modules' \
        --exclude './vendor' \
        --exclude './dist' \
        . | tar -x -f - -C "$stage"

    # Composer, in the stage. Free's plugin file cannot boot without
    # vendor/autoload.php and the artifact must carry no dev dependency;
    # installing here rather than copying is what makes both true at once.
    if [ -f "$stage/composer.json" ]; then
        command -v composer >/dev/null 2>&1 || {
            echo "  ✗ composer not found, and $slug needs vendor/ — cannot build" >&2
            return 1
        }

        echo "  · composer dist"
        composer dist --working-dir="$stage" --quiet
    fi

    apply_distignore "$stage" "$source/.distignore"

    # Down to one tier, before the gate — so what the contract inspects is the
    # tree that is about to become a ZIP and not the one it was cut from.
    if [ -n "$tier_slug" ]; then
        cut_to_tier "$stage" "$tier_slug"
    fi

    # THE GATE. Before the ZIP exists, so that a failure leaves nothing behind
    # that anybody could upload.
    bash "$SCRIPT_DIR/verify-artifact-contract.sh" "$stage"

    rm -f "$zip_path"
    # From the stage's PARENT, so the ZIP holds one top-level directory named
    # for the install slug. Each tier stages under its own parent, and all of
    # them are called `wconvert-pro` inside — three tiers of one plugin, never
    # three plugins.
    ( cd "$(dirname "$stage")" && zip -r -q -X "$zip_path" "$slug" )

    echo "  ✓ $(basename "$zip_path") ($(du -h "$zip_path" | cut -f1 | tr -d ' '))"
}

mkdir -p "$STAGE_ROOT"

# Read from the ladder rather than written out here, so a rung added to
# tiers.json is a rung this builds without being edited.
build_every_tier() {
    local tier

    while IFS= read -r tier; do
        [ -n "$tier" ] || continue

        build_one pro "$tier"
    done < <(php "$SCRIPT_DIR/tier-manifest.php" tiers "$REPO_ROOT/tiers.json")
}

case "$TARGET" in
    free) build_one . ;;
    pro)  build_every_tier ;;
    # A function on the left of && ignores errexit throughout its body,
    # including the artifact gate. Keep these as unconditional commands.
    all)
        build_one .
        build_every_tier
        ;;
esac
