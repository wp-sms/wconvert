#!/usr/bin/env bash
#
# contract-support.sh — what the two shell programs of the gate share.
#
# A library, not a program. `source`d by bin/verify-source-contract.sh and
# bin/verify-artifact-contract.sh; running it directly does nothing.
#
# ADR 0029 requires the three programs of the gate to be three PROGRAMS with no
# flags between them, "so that no opt-out exists to be taken on the day it
# matters". bin/pro-scan-support.php already draws the line this file sits on,
# in as many words:
#
#     "That is a statement about entry points, not about file walkers: two
#      scanners hand-copying a directory traversal would drift, and a scanner
#      that drifts is one that quietly stops looking somewhere."
#
# The same is true one layer up. `run_scan` was copied between the two shell
# programs verbatim, comment and all, and so was the bash-3.2 array dance — and
# a copied fail-closed helper is a fail-closed helper that stops being one in
# one of its two homes.
#
# NOTHING HERE DECIDES WHAT A VIOLATION IS. Each program owns its own question;
# this owns finding things to ask it about, and agreeing on what the answers
# mean.

# Every program that sources this keeps its own FAILURES count; these read and
# write the caller's.
FAILURES=0

fail() {
    echo "  ✗ $1" >&2
    FAILURES=$((FAILURES + 1))
}

pass() {
    echo "  ✓ $1"
}

# ---------------------------------------------------------------------------
# find(1), asked whether anything MATCHES — with its exit status kept.
#
# The obvious spelling, `[ -n "$(find … 2>/dev/null)" ]`, is FAIL-OPEN, and for
# these programs that is exactly backwards: it throws the exit status away, so
# a find that could not read a subdirectory prints nothing, nothing reads as
# "no match", and no match reads as clean.
#
#   0 with output  — found it
#   1              — genuinely absent
#   2              — could not look, and the caller must say so
# ---------------------------------------------------------------------------
find_matches() {
    local out="" rc=0

    out="$(find "$@" -print -quit)" || rc=$?

    if [ "$rc" -ne 0 ]; then
        return 2
    fi

    [ -n "$out" ]
}

# ---------------------------------------------------------------------------
# A directory that must exist, be readable, and hold files of a kind.
#
# An empty scan root is a tree the caller cannot speak for, not a tree with
# nothing wrong in it. Here "no match" and "could not look" collapse to the
# same verdict, which is why find_matches' three-way answer is read as two.
#
#   $1 = tree, $2 = path relative to it, $3 = find(1) name pattern, $4 = label
# ---------------------------------------------------------------------------
require_populated_dir() {
    local tree="$1" rel="$2" pattern="$3" label="$4"
    local dir="$tree/$rel"

    if [ ! -d "$dir" ] || [ ! -r "$dir" ] || [ ! -x "$dir" ]; then
        fail "$rel/ is missing or unreadable — $label"
        return 1
    fi

    if ! find_matches "$dir" -type f -name "$pattern"; then
        fail "$rel/ holds no $pattern files — nothing was inspected, so nothing is proven"
        return 1
    fi

    return 0
}

# ---------------------------------------------------------------------------
# Run one of the Pro scanners over some paths.
#
# The THIRD exit code is the important one: 0 clean, 1 offenders (with a
# non-empty list), anything else means it could not look, which is a failure
# and not a pass. Requiring a non-empty list alongside exit 1 also stops the
# PHP interpreter's own "could not open the script" exit 1 from being reported
# as a leak with a blank offender list — WSMS names that exact misdiagnosis in
# its own guard.
#
#   $1 = bin/ directory, $2 = scanner file, $3 = what a hit means, $4.. = paths
# ---------------------------------------------------------------------------
run_scan() {
    local bin_dir="$1" scanner="$2" label="$3"
    shift 3
    local out="" rc=0

    out="$(php "$bin_dir/$scanner" "$@")" || rc=$?

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

# ---------------------------------------------------------------------------
# The PHP files at a tree's root, as an array the caller can splat.
#
# Globbed rather than named, so adding a root-level PHP file cannot quietly opt
# out of a scan. The caller splats it as `${ROOT_PHP[@]+"${ROOT_PHP[@]}"}`
# rather than `"${ROOT_PHP[@]}"`: under `set -u`, bash 3.2 — which is what
# /usr/bin/env bash still resolves to on macOS — treats an empty array
# expansion as an unbound variable and aborts.
# ---------------------------------------------------------------------------
collect_root_php() {
    local tree="$1"

    shopt -s nullglob
    ROOT_PHP=("$tree"/*.php)
    shopt -u nullglob
}
