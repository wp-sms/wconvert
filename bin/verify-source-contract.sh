#!/usr/bin/env bash
#
# verify-source-contract.sh — the free contract, proven at the source.
#
# Asserts the one invariant that carries the guarantee (ADR 0029, check a):
#
#     No file in free's tree imports a `pro/` path or the Pro namespace.
#
# in TypeScript AND in PHP. It needs no build, so it runs on every pull
# request and a stray premium import is caught by whoever wrote it. WSMS finds
# one only when someone cuts a release, because its guard lives inside
# build.sh — that is the accident this exists not to inherit.
#
#   ./bin/verify-source-contract.sh [free-tree-dir]     (default: the repo root)
#
# Exit 0 = clean. Exit 1 = a violation, OR the check could not look.
#
# IT FAILS CLOSED, and that is not a detail. A check that cannot inspect what
# it was asked to inspect FAILS, because "couldn't look" reading as "clean" is
# how a leak ships the one time a tree is incomplete. WSMS's own check 7 does
# the opposite — it prints a note and skips when the React source is missing —
# and that inversion is deliberate here.
#
# NO FLAGS, EVER. ADR 0029: "A single script with a --source-only flag would be
# the same mistake ADR 0028 refused one layer down — letting a flag decide how
# much of a compliance contract runs. The moment a check has an opt-out, the
# opt-out is what runs on the day it matters." The other two programs of the
# gate are separate programs for the same reason.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(dirname "$SCRIPT_DIR")"

TREE="${1:-$PLUGIN_ROOT}"
TREE="${TREE%/}"

FAILURES=0

fail() {
    echo "  ✗ $1" >&2
    FAILURES=$((FAILURES + 1))
}

echo "==> verify-source-contract: $TREE"

# --- Is there anything to inspect? -------------------------------------------
#
# Every branch here is a fail-closed one. None of them means "clean".

if [ ! -d "$TREE" ] || [ ! -r "$TREE" ] || [ ! -x "$TREE" ]; then
    fail "free tree is not a readable directory: $TREE — cannot verify"
    echo "==> verify-source-contract FAILED with $FAILURES problem(s)." >&2
    exit 1
fi

# free's PHP lives in src/, free's TypeScript in resources/. Both must exist,
# be readable, and hold files of their kind: an empty scan root is a tree this
# check cannot speak for, not a tree with nothing wrong in it.
require_populated_root() {
    # $1 = path relative to the tree, $2 = find(1) name pattern, $3 = label
    local rel="$1" pattern="$2" label="$3"
    local dir="$TREE/$rel"

    if [ ! -d "$dir" ] || [ ! -r "$dir" ] || [ ! -x "$dir" ]; then
        fail "$rel/ is missing or unreadable — cannot verify $label"
        return 1
    fi

    if [ -z "$(find "$dir" -type f -name "$pattern" -print -quit 2>/dev/null)" ]; then
        fail "$rel/ holds no $label files — nothing was inspected, so nothing is proven"
        return 1
    fi

    return 0
}

require_populated_root src '*.php' PHP || true
require_populated_root resources '*.ts' TypeScript || true

if [ "$FAILURES" -gt 0 ]; then
    echo "==> verify-source-contract FAILED with $FAILURES problem(s)." >&2
    exit 1
fi

# --- The scans ---------------------------------------------------------------
#
# Each delegate answers with an exit code, and the THIRD code is the important
# one: 0 clean, 1 offenders (with a non-empty list), anything else means it
# could not look, which is a failure and not a pass. Requiring a non-empty list
# alongside exit 1 also stops the PHP interpreter's own "could not open the
# script" exit 1 from being reported as a leak with a blank offender list —
# WSMS names that exact misdiagnosis in its own guard.
run_scan() {
    # $1 = scanner script, $2 = what a hit means, $3.. = paths to scan
    local scanner="$1" label="$2"
    shift 2
    local out="" rc=0

    out="$(php "$SCRIPT_DIR/$scanner" "$@")" || rc=$?

    if [ "$rc" -eq 0 ]; then
        return 0
    fi

    if [ "$rc" -eq 1 ] && [ -n "$out" ]; then
        fail "$label"
        printf '%s\n' "$out" | sed 's/^/        /' >&2
        return 0
    fi

    fail "$scanner could not run (exit $rc) — cannot verify"
}

# The PHP scan covers src/ AND the plugin bootstrap files at the tree root.
# Those root files ship and are the first thing every install executes, so a
# scan scoped to subdirectories would leave them entirely unread. Globbed
# rather than named, so adding a root-level PHP file cannot quietly opt out.
#
# Unlike src/ and resources/, this one is opportunistic: it scans what is
# there and does not insist something is. The fail-closed line is drawn at the
# two roots above, which is where free's code actually lives.
shopt -s nullglob
ROOT_PHP=("$TREE"/*.php)
shopt -u nullglob

run_scan pro-ts-scan.php "free TypeScript imports a pro/ path:" "$TREE/resources"
# ${ARR[@]+"${ARR[@]}"} rather than "${ARR[@]}": under `set -u`, bash 3.2 —
# which is what /usr/bin/env bash still resolves to on macOS — treats an empty
# array expansion as an unbound variable and aborts.
run_scan pro-php-scan.php "free PHP references Pro (namespace, or a pro/ path):" "$TREE/src" ${ROOT_PHP[@]+"${ROOT_PHP[@]}"}

if [ "$FAILURES" -gt 0 ]; then
    echo "==> verify-source-contract FAILED with $FAILURES problem(s)." >&2
    exit 1
fi

echo "  ✓ source contract clean"
