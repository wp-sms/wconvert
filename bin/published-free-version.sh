#!/usr/bin/env bash
#
# published-free-version.sh — the highest free version actually published.
#
#   ./bin/published-free-version.sh <wp.org-slug>
#
# Prints that version on stdout and nothing else. Exit 0 = it was read. Exit
# 1 = it was not, for any reason at all.
#
# ============================================================================
# WHERE "PUBLISHED" IS READ FROM, AND WHY IT IS NOT THE REPO.
# ============================================================================
# ADR 0030's fifth release-guard condition anchors Pro's WCONVERT_MIN_CORE to
# "the highest free version ACTUALLY PUBLISHED, not the one in the working
# tree", and says the difference is the whole check. So this asks the only
# party that knows: WordPress.org's plugin information API, which is the same
# endpoint every WordPress install asks when it decides whether an update
# exists.
#
# `.version` is the STABLE TAG — the version wp.org serves to an install
# today. That is the right anchor and `.versions` is not: a tag can sit in
# wp.org's SVN without being stable, and a Pro pinned to a version no install
# will be offered is the exact "premium features silently missing" failure
# this condition exists to catch. The number that matters is the one a
# merchant can actually have.
#
# A GIT TAG WOULD NOT DO EITHER, and it is the tempting answer because it is
# free to read. `free-v1.3` existing means we asked wp.org for 1.3; it does
# not mean wp.org is serving it. Anchoring to tags re-introduces the review
# queue as an invisible window in which every Pro release passes a check it
# should fail.
#
# ============================================================================
# IT FAILS CLOSED, INCLUDING WHEN FREE HAS NEVER BEEN PUBLISHED.
# ============================================================================
# wp.org answers `{"error":"Plugin not found."}` for a slug it does not know,
# and that is a failure rather than "0.0.0". It has to be: if free has never
# been published there is no version any install can be running, so there is
# no WCONVERT_MIN_CORE a Pro release could satisfy. FREE SHIPS FIRST, ALWAYS —
# that is a consequence of ADR 0030 rather than a limitation of this script,
# and it is recorded there.
#
# A network failure fails too. A Pro hotfix blocked by a wp.org outage is a
# cost; a Pro hotfix that shipped because nobody could reach wp.org to say no
# is the failure mode ADR 0029 spends its whole length on.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SLUG="${1:-}"

if [ -z "$SLUG" ]; then
    echo "usage: $0 <wp.org-slug>" >&2
    exit 1
fi

URL="https://api.wordpress.org/plugins/info/1.0/${SLUG}.json"

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

# The status is captured rather than turned into a curl failure (-f), because
# 404 has a specific and important meaning here — wp.org does not know this
# plugin — and "could not reach wp.org" would be the wrong sentence to print
# on the day free has simply never been published.
HTTP=""

if ! HTTP="$(curl -sSL --max-time 30 --retry 3 --retry-delay 2 -o "$BODY_FILE" -w '%{http_code}' "$URL")"; then
    echo "could not reach ${URL} — the published free version was not read" >&2
    exit 1
fi

if [ "$HTTP" = "404" ]; then
    echo "wp.org does not know a plugin called '${SLUG}' — nothing has been published there yet." >&2
    echo "There is no free version any install can be running, so no WCONVERT_MIN_CORE can be satisfied." >&2
    echo "Release free first (ADR 0030)." >&2
    exit 1
fi

if [ "$HTTP" != "200" ]; then
    echo "wp.org answered HTTP ${HTTP} for ${URL} — the published free version was not read" >&2
    exit 1
fi

# Piped into a program rather than an inline `php -r`, and that is not tidying:
# the parse is the half of this that can be WRONG, and a parse inside a shell
# heredoc is a parse nothing can assert. bin/wporg-version.php is a pure
# function of these bytes, and ReleaseGuardTest feeds it those bytes directly —
# including the "Plugin not found" body, which is the branch ADR 0030's "free
# ships first, always" rests on.
VERSION=""

if ! VERSION="$(php "$SCRIPT_DIR/wporg-version.php" < "$BODY_FILE")"; then
    echo "could not read a published version out of ${URL}" >&2
    exit 1
fi

printf '%s\n' "$VERSION"
