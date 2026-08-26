#!/usr/bin/env bash
#
# check-publisher.sh — release guard condition 1.
#
#   ./bin/check-publisher.sh <github-actor>
#
# Exit 0 = this account may publish a release. Exit 1 = it may not, or the
# question could not be answered.
#
# ============================================================================
# THE ALLOWLIST LIVES HERE, ONCE, BECAUSE THERE ARE TWO RELEASE WORKFLOWS.
# ============================================================================
# WSMS spells its allowlist inline in the guard step, and that is right for
# WSMS: it has one release workflow, so the list has one home. ADR 0030 gives
# this repo two — `free-v*` and `pro-v*` drive separate runs — and a list
# spelled in both would drift the first time somebody is added to one of them.
# The failure that drift produces is quiet in the worst way: free and Pro
# disagree about who may ship, and nobody finds out until the person who can
# release one cannot release the other.
#
# ============================================================================
# WHOLE-WORD MATCHING, NOT SUBSTRING.
# ============================================================================
# The shape this is usually written in — `case "$ALLOWED" in *"$ACTOR"*)` —
# admits `navid`, `kashani` and the empty string, because each is a substring
# of a real entry. GitHub logins are handed out on a first-come basis, so
# "someone registered a prefix of a maintainer's name" is not a hypothetical.
# The padded compare below is what WSMS's own version does and is why it looks
# the way it does.

set -euo pipefail

# GitHub logins of the accounts permitted to publish a release of either
# plugin. Add a name here and nowhere else.
ALLOWED='mostafasoufi navidkashani'

ACTOR="${1:-}"

if [ -z "$ACTOR" ]; then
    echo "usage: $0 <github-actor>" >&2
    echo "no actor given — the publisher was not checked" >&2
    exit 1
fi

case " $ALLOWED " in
    *" $ACTOR "*)
        echo "✓ $ACTOR is allowed to publish releases"
        ;;
    *)
        echo "$ACTOR is not on the release allowlist. Allowed: $ALLOWED" >&2
        exit 1
        ;;
esac
