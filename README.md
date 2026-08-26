# WConvert

One monorepo, two independently installable WordPress plugins.

| | Plugin directory | Slug | Namespace | Text domain |
|---|---|---|---|---|
| Free | the repository root | `wconvert` | `WConvert\` | `wconvert` |
| Pro | [`pro/`](pro/) | `wconvert-pro` | `WConvert\Pro\` | `wconvert-pro` |

Pro is installed **alongside** free, not instead of it. It does not unlock
free's premium features — it **supplies** them, and a free install has never
contained them ([ADR 0014](docs/adr/0014-pro-replaces-the-loader.md),
[ADR 0015](docs/adr/0015-enforcement-is-by-non-registration.md)).

Read [`CONTEXT.md`](CONTEXT.md) before using any domain term.

## The free/Pro boundary

The dependency runs one way and only one way:

```
resources/loader/src/         free's loader modules   ─┐
pro/resources/loader/src/     Pro's loader modules    ─┴─> pro/…/main.ts
                                                            = free's + Pro's
```

Free's entry composes free's modules. Pro's entry composes free's **plus** its
own. There is **no mode flag and no tree-shaking, ever**: premium code is
absent from the free build because it was never in free's source
([ADR 0028](docs/adr/0028-the-free-loader-source-carries-no-premium-code.md)).

That boundary is drawn on day one, deliberately, rather than deferred behind a
flag. It is the cost of the decision, and it is the whole cost.

### Pro replaces the loader; it never adds a second one

With both plugins active a page carries **exactly one** loader, and it is
Pro's. Pro dequeues free's on `wp_enqueue_scripts`, in PHP, before one byte of
HTML exists — so an aggregating optimizer never sees two scripts to reorder
([ADR 0014](docs/adr/0014-pro-replaces-the-loader.md)). That is the whole
argument against the add-on shape the premium-SDK research recommended: a
second script that must register before the first evaluates is precisely the
failure Autoptimize's force-in-head produces, silently, with nothing in any
log.

Three details are load-bearing rather than incidental:

- **Pro's priority is derived from free's constant**, not written as a number.
  WordPress loads plugins in the order its own option lists them, so a swap
  that worked because `wconvert-pro` was read second would work by accident.
- **Free's handle is deregistered, not just dequeued.** WordPress prints the
  registered dependencies of anything queued, so one third-party script
  depending on `wconvert-loader` would otherwise put free's loader back on a
  page that already has Pro's.
- **A broken Pro degrades to free, never to nothing.** The dequeue is
  conditional on Pro's own bundle existing; an incomplete upload costs the
  merchant `exit_intent`, not every popup on the site.

Turning Pro on or off changes that asset URL on every already-cached page, so
both lifecycle hooks purge the page cache
([`PageCache`](pro/src/Boot/PageCache.php)). Nothing rests on the purge
landing: deactivating a plugin does not delete its files, so a stale page
serves the previous tier's behaviour for a few minutes rather than a 404.

```bash
wp eval-file bin/verify-loader-replacement.php   # needs both plugins active
```

The unit test proves the swap against a script queue that *records* what it was
handed. But WordPress's queue is a **dependency graph**, not a list, and the
hazard lives in the graph: a dequeued handle stays registered, and WordPress
prints the registered dependencies of anything queued. That script enqueues a
third-party script declaring `wconvert-loader` as a dependency, prints the
scripts for real, and asserts free's loader is nowhere in the markup. It also
asserts the cost — that the dependent is dropped along with it — so the
trade-off is on record rather than met in a support ticket.

**There is no licence check anywhere on this path, and nothing is missing.**
Being in Pro's ZIP *is* the entitlement
([ADR 0015](docs/adr/0015-enforcement-is-by-non-registration.md)), so not one
premium feature needs an `if` —
[`tests/unit/Contract/NoLicenceOnTheFrontEndTest.php`](tests/unit/Contract/NoLicenceOnTheFrontEndTest.php)
fails if a second file answers "is Pro loaded", if anything that ships reads a
licence value, or if the front-end path grows a tier branch at all.

### It is checked, not trusted

```bash
bin/verify-source-contract.sh          # no build, runs on every pull request
npm run check:loader                   # two loader builds, runs on every pull request
```

No file in free's tree may import a `pro/` path or the `WConvert\Pro`
namespace, in TypeScript **and** PHP
([ADR 0029](docs/adr/0029-the-free-contract-is-proven-at-the-source.md)). The
check **fails closed**: a tree it cannot inspect *fails*, because "couldn't
look" reading as "clean" is how a leak ships.

One scanner per language does the looking, and neither is a grep.
[`bin/pro-ts-scan.php`](bin/pro-ts-scan.php) parses module specifiers, so
`repro/harness` is not mistaken for a `pro/` path.
[`bin/pro-php-scan.php`](bin/pro-php-scan.php) tokenizes PHP, so free may
*document* the boundary without tripping the guard that enforces it — while a
Pro name in a string literal still fails, because a dynamic class name resolves
it. Both halves apply in both languages: PHP is checked for `pro/` paths too,
since `require_once WCONVERT_DIR . 'pro/…'` is the shape a WordPress developer
reaches for first.

`npm run check:loader` is the **one build a pull request pays for**, and it
earns it: both of its assertions are about build output. Free's and Pro's
loader, gzip -9, hard-fail at 8192 bytes; and free's loader is scanned for
every rule identifier the manifest calls premium — free's *admin* bundle is
deliberately never scanned, because it carries premium identifiers on purpose
for its `locked` cards.

The artifact contract, Plugin Check and the release guard run at **release**,
not here — each half lands with the thing it inspects, and their subject is a
build rather than a source tree. See [Releasing](#releasing).

## The rule manifest

[`resources/rules/manifest.json`](resources/rules/manifest.json) is the single
source of truth for every rule type, on all three axes, in **both** tiers. Free
ships the premium entries too, because free's PHP is what will strip an
unentitled rule at enqueue, and it can only strip what its own manifest calls
premium ([ADR 0005](docs/adr/0005-the-rule-model-is-three-flat-closed-axes.md)).
That strip lands with degradation and suspension; today PHP reads the manifest
for one thing, the publish-time partition into `triggers` and `conditions`.

**Free's loader must never `import` it.** The lookup would be dynamic, so
nothing tree-shakes, and every `tier: pro` identifier would land in free's
bundle — failing the scan above on a build that leaked nothing. Each loader
module declares its own `kind` and `consent_category` instead, and the
parity tests assert the declaration matches the manifest:

```bash
tests/js/manifest-parity.test.ts        # free's modules against the manifest
pro/tests/js/manifest-parity.test.ts    # Pro's own, from Pro's side
tests/unit/Rules/RuleManifestParityTest.php   # the four-field invariant, every axis
```

They are also what decides **where a new rule may land**: a `tier: pro` entry
with no Pro module fails on the pull request that adds it, so a premium entry
and its implementation arrive in the same commit.

## The template vocabulary

[`resources/templates/manifest.json`](resources/templates/manifest.json) is the
closed list of everything a Template may name: six leaf nodes, four layouts,
the token set, the Slot Roles and the field kinds. A Template is a JSON node
tree plus tokens with **no HTML and no CSS in it**
([ADR 0010](docs/adr/0010-templates-are-configuration-not-documents.md)), so
validating against this manifest is the whole of the sanitisation story —
`wp_kses` does not apply to templates at all.

One **dependency-free renderer** in
[`resources/renderer/src/`](resources/renderer/src/) owns the entire vocabulary
and every line of the stylesheet, and **both** bundles import it: the loader
draws the live Optin, the admin draws gallery cards and previews. There are no
static thumbnails to produce or to let go stale, and nothing React-shaped may
enter that tree — two consumers, two bundles, one byte budget.

```bash
tests/js/renderer-manifest-parity.test.ts     # the renderer against the manifest
tests/unit/Template/TemplateVocabularyTest.php # what validation drops on the way in
tests/unit/Template/TemplateSnapshotTest.php   # an Optin's copy outlives its entry
tests/unit/Frontend/PayloadBudgetTest.php      # ten snapshotted trees, ≤2KB gzipped
```

Like the rule manifest, **the loader must never `import` it**: an unrecognised
node is skipped by the renderer's own switch, so the lookup buys nothing and
the import would put the whole vocabulary in the byte budget. The parity test
asserts the renderer implements exactly what the manifest declares, in both
directions.

## Goals and Playbooks

A [[Goal]] is an **enum plus data** — `src/Goal/Goal.php` — and the fifth closed
set this project has refused to make a registry
([ADR 0019](docs/adr/0019-analytics-stores-daily-counters-not-events.md)). Each
of the five declares the metric that counts it, its `tier`, and what the *site*
must have; `GoalRegistry` resolves those two facts into one
[[Availability]] state, and the precedence — **`unavailable` beats `locked`** —
lives in one function so no surface recombines it in an order of its own
([ADR 0026](docs/adr/0026-a-goal-the-site-cannot-serve-is-hidden.md)).

The registry filters nothing. The three states name **why** a member is absent;
**how** it renders is the surface's, and the two surfaces disagree on purpose —
the goal screen hides what a settings list explains, and neither ever renders
`unavailable` as an upsell.

A [[Playbook]] is **data, not code**: `resources/playbooks/*.php`, each
returning an array. PHP rather than JSON because a Playbook is nothing but words
and `wp i18n make-pot` cannot see a JSON string
([ADR 0013](docs/adr/0013-playbook-copy-carries-no-markup.md)); remote entries
are JSON and enter through the same `PlaybookLibrary::fromEntries()`, so the
fetch is **designed and not built**.

**Validation happens at registration, never at runtime**, and that is the only
place the guarantee lives — there is no runtime check behind it. An entry is
refused for filling a [[Slot Role]] its Template does not declare, for naming
anything site-local (a post or term id, a Destination id — including one
sitting inside `destination_hint.types` — or its own link `href`), for pairing a
Goal with a Template metered by the other converting act, for declaring a
[[Display Type]] its Template does not serve, for naming no [[Trigger]], and for
claiming an id another entry already has. A Template offering two converting
acts, or none, is refused the same way.

Refusals are **recorded rather than thrown** — one bad entry must not take the
gallery down — and **not silent**: each one goes to `_doing_it_wrong()`, which
is WordPress's own channel for "a plugin called this wrong". A rejection is an
authoring error, so it surfaces where an author is working rather than as an
admin notice the merchant cannot act on.

```bash
tests/unit/Playbook/PlaybookRegistrationTest.php  # one test per rejection
tests/unit/Playbook/PrefillSnapshotTest.php       # the snapshot boundary, both halves
tests/unit/Playbook/BundledPlaybooksTest.php      # a shipped entry gets no exemption
tests/unit/Goal/GoalParityTest.php                # Availability is spelled twice; a Goal is not
tests/js/availability.test.ts                     # one rule, two surfaces, opposite renderings
tests/js/playbook-copy.test.ts                    # plain text, and no innerHTML in any tree
```

Prefill is **the snapshot boundary that already exists**, not a second one: the
Optin takes a copy of the Template's design and the Playbook's words are written
into it, and the two never speak again. `playbook_id` is provenance exactly as
`template_id` is — neither reaches the browser, and nothing joins on either.

## The lead log

Reading `wconvert_leads` is the one part of WConvert whose correctness is a
property of **SQL** rather than of PHP, and the unit suite deliberately cannot
prove it: `tests/unit/Support/FakeConnection.php` models the table and ignores
the query text, because a fake that re-implemented `GROUP BY` would make itself
the authority on what a database does.

So the queries are proven where queries can be proven:

```bash
wp eval-file bin/verify-lead-log.php   # against a real WordPress and a real database
```

It writes a small fixture, checks that two rows sharing an identifier really do
collapse into one group of two, that the grouping toggle does not move the
headline, that erasure deletes rather than blanks, and that the retention prune
removes what has outlived the period and nothing else — then deletes what it
wrote. **It refuses to run on a log that already has Leads in it**, because two
of those checks delete over the whole table; point it at the throwaway
WordPress above.

The log adds **no index** to a table that takes a write per capture, and
[ADR 0033](docs/adr/0033-the-lead-log-reads-without-a-new-index.md) records
why: the prune is a range over the ULID primary key, the per-Optin listing
walks that key backwards under a `LIMIT`, and grouping is two aggregates that
each use an index already there.

## Destinations, the queue and health

A [[Destination]] is **outbound and fallible** — configured, optional, one of
several, and able to fail without the capture failing
([ADR 0007](docs/adr/0007-destinations-are-outbound-and-fallible.md)). **The
Lead log is not one**: it is the Lead store, written first and always. Free
ships two Destination types — the in-process WSMS push, and the lead-magnet
delivery email over `wp_mail()`. Every type that makes an outbound HTTP call is
Pro's.

**Everything is queued, including the WSMS push.** Action Scheduler is a core
dependency bundled in the free plugin — three free features want a scheduler
with no ESP in sight — and it is loaded from `wconvert.php` rather than through
Composer's autoloader, because it version-negotiates at load and the newest
copy on the site must win.

**A job carries a Lead id and a Destination id, and nothing else.** Job
arguments live in `actionscheduler_actions` for that plugin's whole retention
period, which outlives any retention policy WConvert sets for itself — so
personal data in one would survive both the prune and an honoured erasure
request, in a table nothing here would ever look in again.

**Delivery state is per-Destination health, not a per-Lead record**
([ADR 0008](docs/adr/0008-delivery-state-is-destination-health-not-per-lead.md)).
There is no `wconvert_lead_deliveries` table, because `push()` is idempotent:
once re-pushing a Lead that already landed is harmless, per-Lead precision buys
efficiency rather than correctness. **"Harmless" is a claim about remote state,
and the delivery email is the one type where it does not extend to the
recipient** — `wp_mail()` has no upsert, so a bulk re-push there re-sends the
file and re-counts the delivery. That seam is accepted and recorded rather than
guarded against. What is stored is `last_success_at`,
`last_error`, `last_error_at` and `consecutive_failures`, in their own
non-autoloaded option — deliberately separate from Destination configuration,
so the lost-increment race `update_option` allows can only ever eat advisory
health and never an admin's edit.

The failure split is the whole design, and it inverts under a naive
implementation:

| Outcome | Health | The ring |
|---|---|---|
| success | `last_success_at`, counts cleared | — |
| skipped — nothing to send | — | — |
| **retryable** — the vendor is down | `consecutive_failures++`, retried with backoff | on the last attempt |
| **terminal** — this Lead, specifically | **untouched** | recorded |
| **never enqueued** — the type is not `ready` | `skipped_captures++` | — |

A hundred malformed addresses are a hundred Lead-specific rejections, not a
hundred consecutive outages. They are covered instead by a bounded ring of the
last ~200 terminal failures, holding a Lead id and an error string.

The last row is the third thing that goes wrong and is neither of the other
two. A Destination whose type is not `ready` — a deactivated WP SMS, a lapsed
licence — is **skipped and recorded, never enqueued**: an Action Scheduler job
whose handler is unregistered retries against nothing forever. Nothing was
attempted, so it is not an outage; and one ring entry per capture would fill
200 slots in an afternoon. So it is a counter, and it is what turns a silent
fortnight of dropped pushes into a number beside a re-push button.

### The lead-magnet delivery email

The one Destination type that works on a [[Standalone]] install. Everything
else reaches something that may not be there; this reaches `wp_mail()`, which
every WordPress has — so the **Deliver a lead magnet** [[Goal]] is one a
merchant can complete out of the box rather than one that captures Leads and
sends nothing.

It carries **a link, never an attachment**. `wp_mail()`'s `$attachments` takes
absolute server paths and WConvert has no media-library integration at all, so
there is nothing here that turns a merchant's choice into a path on disk — and
pushing a large PDF through `wp_mail()` on shared hosting is a deliverability
and a memory hazard besides. Three settings: the file URL, the subject and the
message. One `{link}` token, substituted where the message names it and
**appended where it does not**, so a body that never mentions it still arrives
with the download in it.

Its failure split is the table above, argued case by case rather than guessed.
A Lead with no email is *skipped*. **A Destination with no file configured is
`retryable`, not terminal** — it is about the Destination rather than about
this Lead, so health says "N failures in a row: no lead magnet file is
configured" on the screen built to say exactly that, and someone who published
before finishing configuration gets a window to finish in. A transport that
refuses the message is an outage. Only an address WordPress will not send to is
terminal, and that is near-vacuous — capture already refuses anything
`filter_var` rejects.

A successful delivery writes one `lead_magnet_delivered` counter, scoped **both
by Goal and by Destination type**: a merchant can bind the WSMS push *and* the
delivery email to one lead-magnet Optin, and counting the WSMS success as a
delivery would report two deliveries per conversion. `conversions −
lead_magnet_delivered`, clamped at zero, is then the *conversions with no
delivery yet* figure on the Goal's card. Exactly-once is a property of the job
chain — it re-queues only on a retryable failure and stops at success — rather
than of any stored per-Lead flag.

Recovery is **bulk re-push**: replay every Lead for Optins bound to this
Destination since `last_success_at`, staggered against the type's declared
jobs-per-minute — which is what replaces a rate limiter in v1, since only a
replay can approach a vendor's limit. The window is a range over the ULID
primary key, so it costs **no new index**.

```bash
wp eval-file bin/verify-destinations.php   # the plugin boots, AS loads, a capture queues two ids
```

A green suite is not the same as a plugin that runs: that script asserts
`as_enqueue_async_action()` is genuinely defined by the time a capture fires,
and reads the arguments back out of Action Scheduler's own table to check that
no captured value is in them. **It refuses to run on an install that has
Leads.**

With WSMS deactivated the install is [[Standalone]] and fully working: capture,
the lead log, CSV export and the lead-magnet delivery email all run, and the
WSMS Destination reads as `unavailable` rather than `locked` — a missing plugin
is not something we can sell. The delivery email never reads `unavailable`,
because `wp_mail()` is WordPress's and there is nothing for it to be missing.

## Analytics

`wconvert_stats` holds **one row per `(optin_id, stat_date, kind)` with a
`count`, and there is no event table**
([ADR 0019](docs/adr/0019-analytics-stores-daily-counters-not-events.md)). A
modest site writes ~3.65M raw rows a year against ~29k as daily counters. The
price is written down rather than hidden: **you can never recompute**, and
there is no hour-of-day breakdown, ever.

The write is `INSERT … ON DUPLICATE KEY UPDATE count = count + 1`, **atomic at
the database**. That is a claim about MySQL rather than about PHP, so it is
proven against MySQL:

```bash
wp eval-file bin/verify-stats.php   # against a real WordPress and a real MySQL
```

It fires two increments concurrently on two connections — the second blocking
on the row lock the first holds — and asserts the count is two; then does the
same two increments as a **read-modify-write, which loses one**, so the check
is known to be able to fail. It also sets the site to a non-UTC timezone and
asserts the row is stamped with the merchant's day, and dispatches real beacon
requests through `rest_do_request()` to check the published-set validation, the
bot and prefetch filters and the rate limit. **It refuses to run on a site that
already has counts, or on a log that already has Leads**, because counters that
cannot be recomputed are not something to be careful around.

### The dashboard

**A Conversion is interpreted at read, never frozen at write**
([ADR 0020](docs/adr/0020-conversions-are-interpreted-at-read.md)). A counter
row carries no `goal` at all, so **changing an Optin's Goal restates its entire
history** rather than splitting it at the moment of the edit. That will look
like a bug to someone; it is the decision, and it is the price of making a Goal
freely correctable.

The screen is **per-goal cards and no leaderboard**. There is no site-wide
conversion rate, because "click-throughs to the offer" and "conversions on
Optins that capture an email" are different acts and ranking them means
nothing. An Optin's numbers arrive *inside* its Goal's card, which is what
makes a cross-Goal ranking unexpressible rather than merely absent. Conversion
rate is conversions ÷ impressions, and there is no "left without converting" —
it is already `impressions − conversions − dismissals`.

**Soft-deleted Optins keep their counts and lose their row.** A merchant
tidying up in March must not watch February's goal total fall, which is also
why an Optin is never hard-deleted.

The two tables meet **in PHP rather than in a `JOIN`**
([ADR 0034](docs/adr/0034-the-dashboard-joins-in-php.md)): a Goal is tens of
rows of fact, and joining it would denormalise it onto thousands of counters
while costing `Connection` a third widening. `wconvert_stats` still ships no
secondary index — the read is a scan, bounded to one year by
`StatRange::MAX_DAYS`, against an index that would be paid on every beacon.

**No reported number comes from `wconvert_leads`**, which is what
[ADR 0018](docs/adr/0018-erasure-deletes-rather-than-anonymises.md) depends on:
erasure deletes those rows, so a metric read from them would let one erasure
request rewrite a merchant's history. It is checked from both ends —
`tests/unit/Stats/NoCountComesFromTheLeadLogTest.php` walks the reporting
classes' computed dependency closure, and `bin/verify-stats.php` reads the real
query log, then writes a Lead and erases it and asserts no number moved.

**"Today" means the merchant's today.** The screen asks for a *number of days*
and never a date — a date built in the browser is the day of whoever is at the
keyboard — and the far end is `StatDay::today()`, read on the server against
the site's own timezone.

This one needs MySQL rather than the Playground SQLite above, **on the
concurrency half**: the check needs two connections holding real row locks, and
Playground gives one. The other reason this used to give — that `ON DUPLICATE
KEY UPDATE` is MySQL's spelling — has expired. The SQLite integration now
translates it, and three increments on one key really do land as one row with
`count = 3`. So the counters can be exercised under Playground; what cannot be
is the claim the statement exists to make, which is that two writers in the
same instant produce two.

**The beacon is stateless** — no visitor id, no device id, no hashed
fingerprint ([ADR 0017](docs/adr/0017-no-visitor-identifier.md)) — so there is
no consent gate on it at all and no identifier to reintroduce. The endpoint is
public by necessity and hardened lightly and deliberately: the `optin_id` is
validated against the published set, the IP is hashed into a short-lived
transient as a rate limit and stored nowhere, and prefetch, prerender and bot
requests are dropped. What abuse costs is a wrong number on one merchant's
dashboard, not data loss and not a breach.

## The personal-data surface

WConvert registers a WordPress exporter, an eraser and suggested
privacy-policy text
([ADR 0018](docs/adr/0018-erasure-deletes-rather-than-anonymises.md)).

**The eraser issues a `DELETE`, never an anonymising update.** Anonymising is
an update, and [ADR 0002](docs/adr/0002-leads-are-immutable-by-schema.md) has
no update path — `wconvert_leads` has no `status` and no `updated_at` precisely
so a row cannot acquire mutable state without a migration a reviewer will see.

```bash
tests/unit/Lead/NoLeadIsEverUpdatedTest.php   # no update() in either tree names the lead log
tests/unit/Privacy/LeadEraserTest.php         # it deletes, retains nothing, and writes nothing
tests/unit/Privacy/LeadExporterTest.php       # the Consent Record travels; an absent one is not a refusal
```

Retention ships as **keep forever with pruning off**, and the WP-Cron job
exists from day one with nothing to do.

## Development

```bash
composer install && npm install

npm run build          # admin bundle + both loader bundles
npm run check:loader   # the loader byte budget + the premium-identifier scan
composer verify:artifact dist/stage/wconvert   # the artifact contract, on a staged tree
composer test          # PHPUnit
composer phpstan       # PHPStan, level 7
composer verify:source # the source contract
npm test               # Vitest — free's tree and Pro's
npm run typecheck      # tsc --noEmit
npm run lint           # ESLint, --max-warnings=0
```

## Releasing

**Free and Pro release on independent tags** —
[ADR 0030](docs/adr/0030-free-and-pro-release-on-independent-tags.md). Publish a
GitHub Release whose tag is `free-vX.Y.Z` or `pro-vX.Y.Z`; the prefix decides
which of the two workflows runs, and the other reports as skipped. A tag push
on its own does nothing.

```bash
npm run build          # public/ and pro/public/ are gitignored — nothing is stale
bin/build.sh free      # → dist/wconvert-v0.1.0.zip
bin/build.sh pro       # → dist/wconvert-pro-v0.1.0.zip
bin/build.sh all
```

`bin/build.sh` stages a copy, runs `composer install --no-dev` inside it,
applies the tree's own `.distignore`, and then runs
[`bin/verify-artifact-contract.sh`](bin/verify-artifact-contract.sh) **before**
writing the ZIP — a ZIP that exists is a ZIP somebody can upload, so the
contract has to be what decides whether one is written.

### The artifact contract

The third of ADR 0029's three programs, and the one whose subject is a build:

* the free artifact contains **no path under Pro's plugin directory** — including
  in `vendor/composer/`'s generated autoload map, which is a leak the source
  contract structurally cannot see because `vendor/` does not exist until build
  time;
* the free artifact contains **its un-minified source tree**, which is what makes
  `readme.txt`'s source claim true by construction.

It takes a staged tree and **no flags**, and it is not told which plugin it is
looking at: the tree holds exactly one plugin main file and that is the answer
([`bin/plugin-identity.php`](bin/plugin-identity.php)). Zero is not a plugin;
both is one artifact carrying the other inside it, which is the leak.

### The release guard, five conditions

Each is a program under `bin/`, called from both workflows, so the list of who
may publish exists once rather than once per workflow — and so every condition
can be tested. `tests/unit/Contract/ReleaseGuardTest.php` runs all five against
fixture trees, fixture tags and a fixture git repository.

| # | Condition | Program |
|---|---|---|
| 1 | The publisher is on the allowlist | `bin/check-publisher.sh` |
| 2 | The tag names *this* plugin and is shaped like a version | `bin/check-release-tag.php` |
| 3 | The tag is on the default branch | `bin/check-tag-on-branch.sh` |
| 4 | Every statement of the version agrees | `bin/check-release-tag.php` |
| 5 | Pro's `WCONVERT_MIN_CORE` ≤ the highest **published** free version | `bin/check-min-core.php` |

**Condition 4 is three statements for free**, not one: the `Version:` header,
`WCONVERT_VERSION`, and `readme.txt`'s `Stable tag:`. The constant is what
runs; the stable tag is what wp.org serves. Checking one of the three is
checking the one nobody installs.

**Condition 5 is the one worth reading twice.** The anchor is the version
wp.org is *serving*, read from its plugin information API by
[`bin/published-free-version.sh`](bin/published-free-version.sh) — not the
version in the working tree. Anchored to the repo it would pass the exact
release it exists to catch: Pro 1.3 requiring core 1.3 while free 1.3 is still
in the wp.org queue. The comparison itself is
`WConvert\Pro\Boot\MinCoreCheck`, borrowed whole, so the release guard ranks
versions exactly the way every install will.

Two consequences follow, and neither is a bug: **free ships first, always** —
until free is live on wp.org there is no version any install can be running, so
no Pro release can pass — and a wp.org outage blocks a Pro release. That is the
trade a fail-closed check makes.

### Plugin Check

Pinned to the exact version in `.github/plugin-check-version`, blocking on
`error` and reporting `warning`.

`WordPress/plugin-check-action` is deliberately **not** used: it has no input
for the checker's version and always installs the latest from wp.org, so
pinning its SHA pins the wrapper rather than the gate.
[`bin/plugin-check.sh`](bin/plugin-check.sh) does the same sequence with
`--version=` and asserts afterwards that the version it asked for is the one it
got.

```bash
bin/plugin-check.sh dist/stage/wconvert "$(cat .github/plugin-check-version)"
```

It needs Docker — `@wordpress/env` starts a real WordPress and runs wp.org's own
checker inside it. `.github/workflows/plugin-check-drift.yml` runs the **latest**
against `main` weekly, compares it to the pin by finding code, and opens an
issue on anything new.

### Why WordPress 6.2

`WConvert\Database\Connection` takes its SQL as a `literal-string` and its
table as a separate argument, passed to `$wpdb->prepare()` through the `%i`
identifier placeholder that WordPress 6.2 added. That is what makes an injected
table or column name **unexpressible** rather than merely discouraged: PHPStan
rejects any query a variable helped build, at the call site.

### Running both plugins locally

WordPress scans `wp-content/plugins/` exactly one level deep, so Pro is not
found at `wconvert/pro/`. Symlink it beside free:

```bash
ln -s "$PWD/pro" ../wconvert-pro
```

Or boot a throwaway WordPress with both mounted, needing no database:

```bash
npx @wp-playground/cli server --workers=1 \
  --mount "$PWD:/wordpress/wp-content/plugins/wconvert" \
  --mount "$PWD/pro:/wordpress/wp-content/plugins/wconvert-pro"
```

`--workers=1` is not optional: Playground's default six worker threads all
write one SQLite file and corrupt it, which surfaces as intermittent 500s that
read like flaky tests rather than a broken database.

### Running a `bin/verify-*.php` script under Playground

Playground has no WP-CLI, so `wp eval-file` is not available and the scripts are
run through `@wp-playground/cli php` instead. Two things bite, both of them
once:

**The plugin has to be loaded, and activating it mid-request does not do that.**
`activate_plugin()` takes effect on the *next* request, so a script that
activates and then carries on runs against a WordPress that never loaded
WConvert. Mount an mu-plugin that `require`s `wconvert.php` instead — mu-plugins
load before regular plugins and before `plugins_loaded`, so WConvert's own hook
ordering is untouched.

**Loading is not activating, so the tables are not there.** `Installer::install()`
runs on `register_activation_hook`, and `upgradeIfNeeded()` runs on `admin_init`
— neither of which a CLI script reaches. Call the installer explicitly before
requiring the script, or every check downstream fails against a missing schema
rather than against the thing under test.

```bash
# runner.php, mounted at /scratch:
#   require_once '/wordpress/wp-load.php';
#   WConvert\Bootstrap::container()->get(WConvert\Database\Installer::class)->install();
#   require '/wordpress/wp-content/plugins/wconvert/bin/verify-destinations.php';

npx @wp-playground/cli php --php=8.1 \
  --mount "$PWD:/wordpress/wp-content/plugins/wconvert" \
  --mount "$PWD/../mu:/wordpress/wp-content/mu-plugins" \
  --mount "$PWD/../scratch:/scratch" \
  -- /scratch/runner.php
```

`--php=8.1` rather than the default, because 8.1 is this plugin's floor and the
point of the exercise is to run on it.

## Conventions

From WSMS 8 — PHP 8.1+, DI container, service providers, Vite + React admin,
PHPStan, PHPUnit. Read it; copy it; never modify it. **No code is shared**, and
neither release cycle constrains the other
([ADR 0030](docs/adr/0030-free-and-pro-release-on-independent-tags.md)).
