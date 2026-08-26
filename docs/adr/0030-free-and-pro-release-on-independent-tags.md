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

*Built in [#37](https://github.com/navidkashani/wconvert/issues/37), where "published"
had to be given an address. **It is wp.org's plugin information API** —
`api.wordpress.org/plugins/info/1.0/wconvert.json` — read by
`bin/published-free-version.sh`, which is the same endpoint every WordPress install
asks when it decides whether an update exists. Specifically its `version` field, the
**stable tag**: the version wp.org serves to an install today. Not the full
`versions` list, because a tag can sit in SVN without being stable and a Pro pinned
to a version no install will be offered is the exact failure this condition exists
for. The number that matters is the one a merchant can actually have.*

***A git tag would not do**, and it is the tempting answer because it costs nothing
to read. `free-v1.3` existing means we asked wp.org for 1.3; it does not mean wp.org
is serving it. Anchoring to tags re-introduces the review queue as an invisible
window in which every Pro release passes a check it should fail — which is this
section's own sentence, arrived at from the other side.*

***Free ships first, always.** wp.org answers `Plugin not found` for a slug it does
not know, and that is a failure rather than a `0.0.0`: if free has never been
published there is no version any install can be running, so there is no
`WCONVERT_MIN_CORE` a Pro release could satisfy. This is a consequence of the
condition rather than a limitation of the script, and it is worth stating because it
is not visible from the sentence above — until free 0.1.0 is live on wp.org, no Pro
release can pass its own guard. A wp.org outage blocks a Pro hotfix for the same
reason, and that is the trade: a blocked hotfix is a cost, while a hotfix that
shipped because nobody could reach wp.org to say no is the failure the whole gate is
about.*

## Consequences

- **Two release workflows, one gate.** Both runs invoke the same
  `bin/verify-artifact-contract.sh`; only the free run stages for wp.org, and only the
  Pro run evaluates the fifth guard condition.
  *Built in [#37](https://github.com/navidkashani/wconvert/issues/37) as
  `release-free.yml` and `release-pro.yml`. What the two share is **not YAML**: it is
  the programs under `bin/`, one per condition, each existing once and called from
  both. That split was forced rather than chosen — a condition written as a shell
  snippet in a workflow is a condition written twice, and the copy nobody is reading
  is the one that drifts. It also made the guard testable:
  `tests/unit/Contract/ReleaseGuardTest.php` runs all five against fixture trees,
  fixture tags and a fixture git repository, which is not possible for logic that
  lives in a workflow step. Both workflows listen to the same `release: published`
  event, because GitHub cannot filter a release trigger by tag pattern; the prefix
  decides which one runs, and the other reports as skipped.*
- **The version headers are independent facts**, so neither plugin's number implies
  anything about the other's. `WCONVERT_MIN_CORE` is the only statement one makes
  about the other, which is what keeps the skew a single, checkable number.
  *Amended by [#37](https://github.com/navidkashani/wconvert/issues/37): "the version
  header" is not one fact per plugin. **A free release states its version three
  times** — the `Version:` header, `WCONVERT_VERSION`, and `readme.txt`'s `Stable
  tag:` — and a Pro release twice. WSMS's condition 4 checks the header alone, which
  is right for WSMS because a WSMS install has one number; here, checking one of
  three is checking the one nobody installs. The **constant** is what runs, and it is
  what Pro's boot guard compares `WCONVERT_MIN_CORE` against — a header and a tag
  that agree while the constant lags ships a free plugin that tells Pro it is older
  than it is. The **stable tag** is what wp.org serves: a correct ZIP uploaded under
  a stale one hands every existing install the old version, and looks like a
  successful release from every angle except the only one that counts. Condition 4
  asserts all of them.*
- **A shared-engine fix ships twice**, at different times, on purpose. Already booked
  by 0014; this is the mechanism that makes it possible rather than a new cost.
