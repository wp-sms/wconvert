#!/usr/bin/env bash
#
# build.sh — the release build. Two plugins, one monorepo.
#
#   ./bin/build.sh free     → dist/wconvert-v{VER}.zip
#   ./bin/build.sh pro      → dist/wconvert-pro-v{VER}.zip
#   ./bin/build.sh all      → both
#
# Each artifact is a self-contained, installable WordPress plugin ZIP with a
# single top-level directory named for its install slug. Free and Pro are
# SEPARATE PLUGINS installed alongside each other (ADR 0014), not two builds of
# one — so there is nothing to strip out of free and no per-tier module set to
# assemble. Staging is a copy, a .distignore, and a zip.
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
# One artifact.
#
# $1 = the source tree to stage from, relative to the repo root ('.' or 'pro')
# ---------------------------------------------------------------------------
build_one() {
    local source_rel="$1"
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

    local stage="$STAGE_ROOT/$slug"
    local zip_path="$DIST/${slug}-v${version}.zip"

    echo "==> build: $slug $version (from ${source_rel}/)"

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

        echo "  · composer install --no-dev"
        composer install \
            --working-dir="$stage" \
            --no-dev --optimize-autoloader --no-interaction --quiet
    fi

    apply_distignore "$stage" "$source/.distignore"

    # THE GATE. Before the ZIP exists, so that a failure leaves nothing behind
    # that anybody could upload.
    bash "$SCRIPT_DIR/verify-artifact-contract.sh" "$stage"

    rm -f "$zip_path"
    ( cd "$STAGE_ROOT" && zip -r -q -X "$zip_path" "$slug" )

    echo "  ✓ $(basename "$zip_path") ($(du -h "$zip_path" | cut -f1 | tr -d ' '))"
}

mkdir -p "$STAGE_ROOT"

case "$TARGET" in
    free) build_one . ;;
    pro)  build_one pro ;;
    all)  build_one . && build_one pro ;;
esac
