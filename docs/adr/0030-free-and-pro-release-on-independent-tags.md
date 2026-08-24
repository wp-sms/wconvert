# Free and Pro release on independent tags

`free-v*` and `pro-v*` are separate tags with independent version numbers, each
driving its own release run out of the one monorepo.

## Why not one tag

WSMS releases every artifact from a single tag, and its release guard asserts the tag
equals `wp-sms.php`'s `Version:` header. That precedent does not transfer, because
WSMS's free and premium plugins are **mutually exclusive** — only one is ever
installed, so there is no second version to skew against and lockstep costs nothing.

[ADR 0014](0014-pro-replaces-the-loader.md) booked the opposite arrangement and one
of its costs explicitly: *"a shared-engine bugfix needs two releases, and the free one
carries wp.org review latency while Pro's ships immediately."* A single tag silently
un-books that. It would put every Pro hotfix in a queue behind a wp.org review the
hotfix has no reason to wait for, which is the coupling the add-on shape was chosen to
avoid.

## What bounds the skew

Independent tags make version skew real, and
[ADR 0015](0015-enforcement-is-by-non-registration.md)'s `WCONVERT_MIN_CORE` boot
guard is what bounds it. Nothing currently asserts that constant against reality, so
the release guard gains a **fifth condition**, beside WSMS's four (publisher is
allowed, tag looks like a version, tag is on the default branch, tag matches the
version header):

> **Pro's `WCONVERT_MIN_CORE` must be ≤ the highest free version actually published.**

The anchor is the *published* version, not the one in the working tree, and the
difference is the whole check. The failure it catches is Pro 1.3 requiring core 1.3
while free 1.3 sits in the wp.org review queue — a Pro that refuses to boot on every
install that can exist, presenting to the merchant as premium features silently
missing with no error they can act on. A check anchored to the repo would pass that
release.

## Consequences

- **Two release workflows, one gate.** Both runs invoke the same
  `bin/verify-artifact-contract.sh`; only the free run stages for wp.org, and only the
  Pro run evaluates the fifth guard condition.
- **The version headers are independent facts**, so neither plugin's number implies
  anything about the other's. `WCONVERT_MIN_CORE` is the only statement one makes
  about the other, which is what keeps the skew a single, checkable number.
- **A shared-engine fix ships twice**, at different times, on purpose. Already booked
  by 0014; this is the mechanism that makes it possible rather than a new cost.
