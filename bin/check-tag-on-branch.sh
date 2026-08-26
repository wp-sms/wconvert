#!/usr/bin/env bash
#
# check-tag-on-branch.sh — release guard condition 3.
#
#   ./bin/check-tag-on-branch.sh <repository> <commit> <branch>
#
# Exit 0 = the commit is on that branch. Exit 1 = it is not, or the question
# could not be answered.
#
# ============================================================================
# WHY THIS MATTERS MORE HERE THAN IT DOES FOR WSMS.
# ============================================================================
# .github/workflows/ci.yml triggers on `pull_request` and NOTHING ELSE, on
# purpose — a pull request is tested against the result of merging it, so
# running the same suites again on `main` a moment later re-proves what the
# pull request proved. The cost of that choice is precisely this: a commit that
# was never merged has had NO suite run against the result of merging it, and
# there is no second gate behind this one to catch it.
#
# ============================================================================
# "NOT AN ANCESTOR" AND "NO SUCH COMMIT" ARE DIFFERENT ANSWERS.
# ============================================================================
# The usual spelling is `if git merge-base --is-ancestor "$SHA" "$BRANCH"`,
# which is fail-closed — good — but reports a typo'd branch name, a shallow
# clone that cannot see the history, and a genuinely un-merged commit as one
# thing: "not on the default branch". Two of those three send whoever reads the
# message hunting for a merge that was never the problem, and the shallow-clone
# case is the one most likely to be hit by a workflow change rather than by a
# person. `merge-base --is-ancestor` exits 1 for "no" and 128 for "cannot", so
# the distinction is already there to be kept.

set -euo pipefail

REPO="${1:-}"
COMMIT="${2:-}"
BRANCH="${3:-}"

if [ -z "$REPO" ] || [ -z "$COMMIT" ] || [ -z "$BRANCH" ]; then
    echo "usage: $0 <repository> <commit> <branch>" >&2
    echo "cannot check which branch a commit is on without all three" >&2
    exit 1
fi

git_in() {
    git -C "$REPO" "$@"
}

if ! git_in rev-parse --git-dir >/dev/null 2>&1; then
    echo "cannot check: $REPO is not a git repository" >&2
    exit 1
fi

if ! git_in rev-parse --verify --quiet "${COMMIT}^{commit}" >/dev/null; then
    echo "cannot check: this repository has no commit '$COMMIT'" >&2
    echo "A shallow clone is the usual cause — the guard needs fetch-depth: 0." >&2
    exit 1
fi

if ! git_in rev-parse --verify --quiet "${BRANCH}^{commit}" >/dev/null; then
    echo "cannot check: this repository has no branch '$BRANCH'" >&2
    exit 1
fi

RESULT=0
git_in merge-base --is-ancestor "$COMMIT" "$BRANCH" || RESULT=$?

if [ "$RESULT" -eq 0 ]; then
    echo "✓ $COMMIT is on $BRANCH"
    exit 0
fi

if [ "$RESULT" -eq 1 ]; then
    echo "$COMMIT is NOT on $BRANCH — refusing to release un-merged code." >&2
    echo "Merge to $BRANCH first, then re-tag from there." >&2
    exit 1
fi

echo "cannot check whether $COMMIT is on $BRANCH — git exited $RESULT" >&2
exit 1
