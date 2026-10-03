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

Planned follow-ups and deferred work: [Product todo list](docs/TODO.md).

React to live campaign opening, closing, and first lead capture with the
[JavaScript events API](docs/guides/javascript-events.md). Campaign details
include a copy button for the existing campaign/variant ID.

## Import and export designs

See the [step-by-step import/export guide](docs/guides/import-export-designs.md),
including where to find Campaign actions and how to resolve upload problems.

In the campaign editor, open **Campaign actions → Export design** to download the
current design, including unsaved changes, as a `.wconvert.zip`. Supported local
PNG/JPEG/WebP images travel with it. Unavailable images need explicit omission.

Use **Campaign actions → Import design**, choose the file, and review its desktop
and mobile preview. File content is the default; **Keep my current content** fits
current words and pictures into matching slots. Review links before applying.
**Apply to draft** is undoable and does not save or publish the campaign. Imported
pictures become normal Media Library items and remain there after Undo.

Transport is available in Free; designs using paid formats/journeys still need
Pro. ZIP support and private temporary storage are required on the server.
Maximum ZIP size is 25 MiB or the host's lower limit. No campaign settings,
connections, leads or history are exported. Fonts, remote-only pictures, SVG
uploads and linked documents are not embedded. See the
[contract and limits](docs/adr/0113-template-files-replace-only-reviewed-draft-designs.md).

## Spam protection

Settings → Spam protection offers optional Cloudflare Turnstile Managed,
Google reCAPTCHA v2 checkbox, or hCaptcha with merchant-owned keys in Free.
Baseline hidden-field checks and request limits work without a provider.
Every queued resource email also uses a ten-minute recipient/resource guard;
this can suppress recent bulk re-pushes while preserving separate Leads.
Pro adds exact email/domain blocklists and email exceptions on every paid rung.

No external verification service is enabled by default. Saving keys is not a
connection test: use **Test saved setup** on the configured hostname before
relying on it. Verification errors preserve the form for retry. Secrets never
appear in API read responses. No table or column is added.

See the [setup guide](docs/guides/spam-protection.md),
[implementation and deferred work](docs/plans/spam-protection.md), and
[architecture decision](docs/adr/0111-spam-protection-precedes-capture.md).

## Multi-screen capture

Free includes editable linear journeys: offer screens, questions, a final Submit,
and acknowledgement. Next and Back keep answers on the current page. An optional
other-channel signup can follow a completed email or SMS signup: each accepted
signup is saved and queued immediately, while the journey keeps one combined
Lead and one Conversion. Skipping optional SMS preserves the email signup.

Start with one of the four `journey-*` Templates/Playbooks. JSON uses `tree.v: 2`
with explicit screen wrappers and field/consent ownership. See the
[contract](docs/plans/184-progressive-capture/README.md) and
[verification record](docs/plans/184-progressive-capture/verification.md).
Atomic capture requires transactional InnoDB storage; Action Scheduler handles
queued delivery and recovery. Pro display/integration entitlements are unchanged.

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
loader, gzip -9, hard-fail at 14,592 / 25,088 / 26,624 / 26,880 bytes for Free / Basic / Pro / Elite (ADR 0111); and free's loader is scanned for
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
closed list of everything a Template may name: the leaf nodes, the layouts, the
token set, the Slot Roles and the field kinds. A Template is a JSON node
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

## The design library, and how a card is drawn without its design

`resources/templates/library/*.json` is what this ZIP ships; **every facet the
picker filters by is derived from the tree** rather than authored, because a
Template carries no words and so cannot honestly be tagged by industry or
season ([ADR 0043](docs/adr/0043-the-library-is-indexed-and-its-facets-are-derived.md)).
The manifest's sibling `facets` section says which of them are offered as chips.

`GET /wconvert/v1/templates` is an **index** — id, name, Display Type, tier,
availability and facets, with **no tree** — and `GET /templates/trees?ids=…`
answers for the cards on screen. A card mounts its live render only while it is
near the viewport and takes it down again, which is what makes a library ten
times this size affordable without a virtualization library.

A design declares its `tier`. Free ships free designs and, in
`resources/templates/locked.json`, the **card** for a premium one — a name, its
facets and a link to a live preview on wconvert.io, with no tree and no image
at all. Shipping the design and refusing the save is trialware
([#7](https://github.com/navidkashani/wconvert/issues/7)), so
`bin/verify-artifact-contract.sh` check **(e)** refuses a `tier: pro` entry, or
a `tree` in `locked.json`, inside the free artifact — and refuses a **Pro**
artifact that carries no premium design at all, which is the same rule read from
the other end.

**Pro's designs live under `pro/resources/templates/library/`** and are
registered through the same `TemplateSource` seam, from
`ProServiceProvider::register()`. That registration is also what makes the
upsell disappear: `TemplateLibrary::locked()` drops a stub whose id a real entry
already holds, so *"a paying customer is never shown an advertisement for what
they bought"* ([ADR 0026](docs/adr/0026-a-goal-the-site-cannot-serve-is-hidden.md))
falls out of the id rather than out of a tier check. `LockedTemplates` is
composed **last**, which is what makes that true.

```bash
tests/js/renderer-manifest-parity.test.ts      # the renderer against the manifest
tests/unit/Template/TemplateVocabularyTest.php # what validation drops on the way in
tests/unit/Template/TemplateSnapshotTest.php   # an Optin's copy outlives its entry
tests/unit/Template/TemplateFacetsTest.php     # every shipped design's facets, from its tree
tests/unit/Rest/TemplateRoutesTest.php         # the index carries no tree, and locked cards link
tests/unit/Frontend/PayloadBudgetTest.php      # five distinct Campaigns, ≤2.5KiB gzipped
tests/unit/Template/LibraryLintTest.php        # bin/verify-templates.php, over the shipped library
tests/unit/Pro/Template/ProLibraryTest.php     # a Pro install is shown no upsell for a design it has
```

Like the rule manifest, **the loader must never `import` it**: an unrecognised
node is skipped by the renderer's own switch, so the lookup buys nothing and
the import would put the whole vocabulary in the byte budget. The parity test
asserts the renderer implements exactly what the manifest declares, in both
directions.

A stored tree carries a **`v`** — the vocabulary version that wrote it
([`TemplateTree::VERSION`](src/Template/TemplateTree.php)). Nothing reads it
yet, and that is the point: an Optin's snapshot is as old as the Optin and the
code reading it is as new as the release, which is safe while the vocabulary
only widens and unrecoverable the first time something is renamed.

### Writing a design by hand

```bash
composer verify:templates     # or: php bin/verify-templates.php [tree ...]
```

`bin/verify-templates.php` decodes each library file **raw**, runs it through
the vocabulary, and diffs — reporting every dropped node, param, token and Slot
Role, plus files that failed to decode at all. It runs without WordPress,
because an authoring check nobody can run from the directory they are authoring
in is an authoring check nobody runs;
`tests/unit/Template/LibraryLintTest.php` is what makes it a gate.

It exists because authoring has six silent failures and three of them cost a day
each: a **JSON syntax error skips the file entirely** with no rejection recorded
and nothing logged; a **misspelled `tree` key becomes a Pro upsell card** for the
design the file contains, because no tree is the whole discriminator for "a
design this install did not get"; and a **dropped Slot Role** reaches a real
Optin as an empty `<p>`, while the gallery card looks right because an entry
keeps its own placeholder text.

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
wp eval-file bin/verify-lead-log.php --use-include   # against a real WordPress and database
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
ships the WSMS push, MailPoet push when MailPoet is installed, and lead-magnet
delivery email over `wp_mail()`. The Pro `destinations` module adds Mailchimp
and Brevo email-contact adapters.

For a remote provider, connect an account on the Destinations page, create a
named Destination for one audience/list, and choose whether existing contacts
keep their details or receive the fields included in a new submission. A
campaign sends basic supported contact details automatically. Its optional
**Send extra answers** control maps captured questions, interest or message to
provider text fields for each signup step. Preview uses sample values without
sending; **Send test contact** sends the sample to the provider. Publishing the
campaign makes edited mappings live.

For marketing signups, Mailchimp requests confirmation for a new member and
Brevo adds a new Contact to the selected list. An enquiry is saved as a
Mailchimp transactional Contact or a Brevo Contact without list membership;
its email address alone does not grant marketing consent. An explicit test send
uses the merchant's own address and can enter the selected marketing list.

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

**Long-lived delivery state is per-Destination health, not a per-Lead record**
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

The Destinations page also shows recent Action Scheduler attempts for each
route. WConvert records whether the provider accepted the request, a retry was
scheduled, or the attempt needs attention. Scheduler completion alone does not
prove provider acceptance, and attempts without a WConvert outcome marker are
shown as unknown. This history lasts only as long as the site's Action
Scheduler cleanup policy retains it.

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
wp eval-file bin/verify-stats.php --use-include   # against a real WordPress and MySQL
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

### Verifying database behavior safely

CI installs a fresh WordPress 6.8 on MySQL 8.4 and runs the stats, lead-log and
literal-search verifiers under PHP 8.2. Together they check MySQL's counter
atomicity, the lead log's grouping/erasure/pruning SQL, and captured-value
search escaping. Run the same checks only against a throwaway MySQL-backed
WordPress with the free plugin active:

```bash
WP_PATH=/absolute/path/to/throwaway-wordpress
wp eval-file "$PWD/bin/verify-stats.php" --use-include --path="$WP_PATH"
wp eval-file "$PWD/bin/verify-lead-log.php" --use-include --path="$WP_PATH"
wp eval-file "$PWD/bin/verify-lead-search.php" --use-include --path="$WP_PATH"
```

`--use-include` preserves the scripts' `strict_types` declaration under WP-CLI
2.12. Both write and delete fixtures: the stats verifier refuses existing
counters or Leads, and the lead-log verifier refuses existing Leads. Never
point them at a live or valued site.

**The beacon is stateless** — no visitor id, no device id, no hashed
fingerprint ([ADR 0017](docs/adr/0017-no-visitor-identifier.md)) — so there is
no consent gate on it at all and no identifier to reintroduce. The endpoint is
public by necessity and hardened lightly and deliberately: the `optin_id` is
validated against the published set, the IP is hashed into a short-lived
transient as a rate limit and stored nowhere, and prefetch, prerender and bot
requests are dropped. What abuse costs is a wrong number on one merchant's
dashboard, not data loss and not a breach.

## Scheduling

An [[Optin]] can carry `starts_at`, `ends_at`, both or neither. Both live in the
`config` blob beside `frequency` and `priority` — **no column**, because no
screen filters or sorts on a schedule and `parent_id` is a column only because
the Optins list has to filter on it
([ADR 0001](docs/adr/0001-custom-tables-not-custom-post-types.md)).

The one thing to know before touching any of it: **a scheduled Optin is IN the
published set on both sides of its window**. That is
[ADR 0050](docs/adr/0050-a-scheduled-optin-stays-in-the-published-set.md), and
excluding one is the implementation that looks obviously right and silently
never shows the campaign — the set is rebuilt on write and never on a timer, so
nothing runs at the moment a window opens. The Optin ships and the browser
decides.

The merchant authors a **local wall time** and the payload carries **one
absolute instant in milliseconds**. `src/Optin/Schedule.php` is the one
converter, it is pure and takes the zone as an argument for the reason
`StatDay` does, and `PublishedProjection` resolves through `wp_timezone()` on
every rebuild — so correcting the site's timezone corrects every schedule with
it, which `update_option_timezone_string` and `update_option_gmt_offset` are
hooked to make actually happen. `resources/loader/src/schedule.ts` compares the
result to `Date.now()` and names no timezone anywhere;
`tests/js/builder-schedule.test.ts` asserts that structurally, on the source.

Its two doors are the thing to read before changing either. `fromArray()` is
the author's and **refuses** — an unreadable boundary and an impossible pair,
which are the same harm reached two ways. `windowIn()` is the reader's, is
**total**, and **fails shut**: an impossible stored pair ships verbatim, so the
half-open comparison finds no instant inside it and the Optin never shows,
where dropping it would read as *never scheduled* and show a finished sale
forever.

```bash
wp eval-file bin/verify-schedule.php   # against a real WordPress; runs on Playground's SQLite
```

It sets a real `timezone_string` to a half-hour offset zone and then to another,
asserting the published option's instants move; asserts a not-yet-started Optin
and a finished one are both in it; proves a bare `gmt_offset` site resolves as
well as a named zone; dispatches a backwards schedule through
`rest_do_request()` for its 400; and rebuilds over a hand-edited backwards blob
to prove the reader's door is total. **It refuses to run on a site that already
has Optins**, because it rebuilds the published set.

## Telling visitors apart, and letting another plugin help

The Targeting axis holds two visitor predicates — `logged_in` and `role` — as
**fields** rather than as members of the include and exclude lists. Those lists
union page SETS, so a visitor rule in one would not narrow an Optin: it would
widen it to the whole site for anyone who matched, silently. `TargetingType`
enumerates the page rules and nothing else, which is what makes that
unbuildable rather than merely discouraged
([ADR 0005](docs/adr/0005-the-rule-model-is-three-flat-closed-axes.md)).

`role` is **one predicate over several systems**. WordPress roles are one answer
to *what is this visitor*; a membership level, a plan or an enrolment is the
same question asked of another plugin, so they share one rule type, one control
and one evaluator. A membership or LMS plugin adds a source and changes nothing
here:

```php
add_action('wconvert_loaded', function (): void {
    WConvert\Bootstrap::container()
        ->resolve(WConvert\Targeting\RoleRegistry::class)
        ->add(new MyMembershipRoles());   // implements RoleSource
});
```

`RoleSource` is two methods: `offered()`, what a merchant may choose, asked once
while the rules panel renders; and `held()`, what THIS visitor holds, asked on
every uncached page view of a page whose published set names a role — so it is a
hot path, and the slugs share one namespace with WordPress's roles.

```bash
wp eval-file bin/verify-role-sources.php   # registers a source the documented way, then asks both surfaces
```

That script exists because a unit suite structurally cannot prove the one claim
the seam makes: `RoleRegistryTest` builds a registry by hand and asserts the
arithmetic, and a fake registry passes however wrong the container's lifetime
and the hook's timing are.

## Placing an inline Optin

`inline` is the one [[Display Type]] that is not an overlay. The other three
mount themselves into the top layer; this one renders where it was embedded, so
it needs somewhere on the page to go — and **both authoring surfaces emit the
same element and nothing else.**

```
src/Frontend/InlineAnchor.php          the element, and the one place it is written
src/Frontend/InlineOptinBlock.php      wconvert/inline-optin   → InlineAnchor::html()
src/Frontend/InlineOptinShortcode.php  [wconvert_optin id=…]   → InlineAnchor::html()
resources/blocks/inline-optin/         block.json + the editor bundle's source
public/blocks/inline-optin.js          built by `npm run build:block`
```

```html
<div data-wconvert-optin="01J…"></div>
```

That attribute is `INLINE_ANCHOR_ATTRIBUTE` in
`resources/loader/src/present.ts`, which resolves it with one
`document.querySelector` per payload entry.
`tests/unit/Frontend/InlineAnchorTest.php` reads the constant out of the
TypeScript and holds the PHP to it, because the two spellings drift silently:
the anchor stays on the page, the loader queries a name that is not on it, and
every inline Optin on the site renders nothing.

**A third surface is a one-liner.** A page builder module or a theme helper
calls `InlineAnchor::html($id)` and is done. Nothing else about rendering
belongs on either surface — the block does not preview the template
server-side, and the shortcode enqueues nothing the loader does not already
enqueue.

### Three behaviours that must not change

- **An anchor whose Optin is not in the payload renders nothing and records
  nothing.** The loader walks the payload looking for anchors, never the
  reverse, so a block left behind by an unpublished, deleted, [[Suspended]] or
  retyped Optin is never looked at. That is the ordinary end of an Optin's
  life, not an error, and the page it sits on is one WConvert was asked to
  leave alone (ADR 0004).
- **Two anchors for one Optin on one page report one [[Impression]].** One
  Optin appearing to one visitor, once.
- **Neither surface validates against the published set.** They stay exactly
  as clever as each other, which is what makes them substitutable. Where an
  unresolvable id is *reported* is the editor, which is the surface that can
  ask.

`tests/js/loader-inline-anchor.test.ts` holds the first two through the real
presenter; `tests/js/block-shortcode-parity.test.ts` holds the names the editor
bundle and PHP share.

### The block is a real block, and its canvas is a placeholder

It offers the site's published inline Optins **by name** — a merchant picks
something they recognise rather than pasting a ULID — and it renders a labelled
placeholder in the editor canvas, never the Optin.
[ADR 0040](docs/adr/0040-the-builders-preview-is-an-input.md) made the
*builder's* preview an input, a surface the merchant works on; the post editor
is not the builder, nothing on that screen can change what the Optin says, and
a render there would be the static thumbnail
[ADR 0010](docs/adr/0010-templates-are-configuration-not-documents.md) says
does not exist anywhere in this flow.

The picker's list is handed over on `enqueue_block_editor_assets` rather than
fetched. A route would need a capability, and the honest one is not
`manage_options` — whoever can open the post editor can place this block — so
answering it properly means a third exception to `WConvert\Rest\Routes`' one
capability, plus a loading state, an error state and a controller, for a list
the editor page could simply have arrived with. What it costs instead is
staleness measured in one page load. `WConvert\Frontend\InspectorEnqueue`
declines a route for a related reason.

**The block is also the only screen in WConvert that shows an Optin's id.** The
Optins list reads no LONGTEXT and so carries no display type (ADR 0001), the
builder is opened by React state rather than by a URL, and the eligibility
inspector prints rules rather than ids — so the picker printing the shortcode
for whichever Optin was chosen is what makes the shortcode usable at all.

## The personal-data surface

WConvert registers a WordPress exporter, an eraser and suggested
privacy-policy text
([ADR 0018](docs/adr/0018-erasure-deletes-rather-than-anonymises.md)).

Data & privacy also shows a read-only, site-specific data map. It explains the
stored Lead fields, saved retention period, configured destination types,
browser-local campaign state, short-lived anonymous-count rate limit and copies
outside WConvert. The policy suggestion reads the same facts, while WordPress
still leaves publication and legal review to the site owner
([ADR 0094](docs/adr/0094-privacy-guidance-reports-the-current-data-flow.md)).
Its copy follows WordPress's collect/purpose, recipients, retention and rights
structure; merchant-only customization guidance is omitted when WordPress
copies the suggested text into a policy.

Privacy guidance is on by default. It adds a short, purpose-specific Privacy
Policy notice to new Campaign setups and checks that notice in the editor's
readiness review. A merchant can turn that authoring help off under Data &
privacy for a simpler editor and simpler future drafts. Existing Campaigns do
not change, and export, erasure, retention, Consent Records, the Data Map and
WordPress privacy-policy tools remain active
([ADR 0096](docs/adr/0096-privacy-authoring-help-is-progressive-and-snapshotted.md)).

**The eraser issues a `DELETE`, never an anonymising update.** Anonymising is
an update, while erasure must remove the whole accepted record. The only allowed
Lead additions belong to the same short-lived capture journey; general profile
editing remains outside WConvert ([ADR 0103](docs/adr/0103-progressive-capture-keeps-one-lead-per-journey.md)).

The WordPress adapter remains email-addressed. A verified phone-only request
uses capture history's exact-phone search and CSV, then deletes every Lead whose
`phone` column directly carries that value. It never follows an email/phone link
to another row, and the action cannot be narrowed by Campaign, date or an
individual Lead ([ADR 0093](docs/adr/0093-privacy-erasure-is-bound-to-one-explicit-identifier.md)).

```bash
tests/unit/Lead/NoLeadIsEverUpdatedTest.php   # no update() in either tree names the lead log
tests/unit/Privacy/LeadEraserTest.php         # it deletes, retains nothing, and writes nothing
tests/unit/Privacy/LeadErasureTest.php        # exact email/phone scope and diagnostic cleanup
tests/unit/Privacy/LeadExporterTest.php       # the Consent Record travels; an absent one is not a refusal
tests/unit/Privacy/DataMapTest.php             # only provable configured facts; no credentials
```

Retention ships as **keep forever with pruning off**, and the WP-Cron job
exists from day one with nothing to do.

## Development

```bash
composer install && npm install

npm run build          # admin bundle, block bundle, both loaders, both inspectors
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
bin/build.sh pro       # → one ZIP per tier (below)
bin/build.sh all
```

`bin/build.sh` first rebuilds and checks reviewed collection revisions, then stages a copy, runs `composer install --no-dev` inside it,
applies the tree's own `.distignore`, and then runs
[`bin/verify-artifact-contract.sh`](bin/verify-artifact-contract.sh) **before**
writing the ZIP — a ZIP that exists is a ZIP somebody can upload, so the
contract has to be what decides whether one is written.

### Pro is one plugin at three tiers

`bin/build.sh pro` loops the ladder in [`tiers.json`](tiers.json) and writes one
ZIP per rung — [ADR 0056](docs/adr/0056-the-tier-ladder-is-a-manifest.md):

```
dist/wconvert-pro-basic-v0.1.0.zip     display-types
dist/wconvert-pro-pro-v0.1.0.zip       + premium-triggers
dist/wconvert-pro-elite-v0.1.0.zip     + cart-recovery
```

**All three are built on every release run and one is sold.** Machinery that is
not exercised rots, and the release that first needs a per-tier build is the
release nobody can wait for. Three ZIPs cost seconds.

A **module is a directory** under `pro/modules/`, holding its own `module.json`.
A rung's ZIP is the full Pro tree with the directories that rung does not ship
deleted — a `rm -rf` rather than cut-out markers and a build-time denylist. That
is also what makes the installed tier a fact rather than a stored label: a
running install reads the module directories back and infers its own rung
(`WConvert\Support\WpProPresence`), and so does the artifact contract, which is
why no `--basic` flag exists to be passed to the wrong tree.

The **top-level directory inside every Pro ZIP is `wconvert-pro`**, at every
rung. They are one plugin at three tiers, so moving up replaces an install
rather than adding a second beside it; only the ZIP's own name carries the tier.

### The artifact contract

The third of ADR 0029's three programs, and the one whose subject is a build:

* the free artifact contains **no path under Pro's plugin directory** — including
  in `vendor/composer/`'s generated autoload map, which is a leak the source
  contract structurally cannot see because `vendor/` does not exist until build
  time;
* the free artifact contains **its un-minified source tree**, which is what makes
  `readme.txt`'s source claim true by construction;
* no premium design ships in the free ZIP — the trialware gate, issue #7;
* **no artifact carries a higher tier's module**, in PHP *and* in the built
  JavaScript. WP Statistics proves this and WSMS does not: all three of its
  premium tiers ship a byte-identical `main.js`, so a Basic customer holds the
  Elite React UI behind a client-readable flag. Under possession-gating that is
  not a weaker gate, it is no gate;
* the free artifact carries **no licensing SDK**. A licence gates updates and
  support and never a feature ([ADR 0015](docs/adr/0015-enforcement-is-by-non-registration.md)),
  so the code that reads one is Pro's alone — and like the autoload map, this is
  checked at the artifact because `vendor/` is generated.

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

**The free plugin passes this gate**, as of
[#60](https://github.com/navidkashani/wconvert/issues/60): zero errors, and
eighteen warnings printed in full. The first run against a real staged tree
reported 53 errors — escaping, i18n and `WordPress.DB.PreparedSQL` findings in
`src/` and `resources/playbooks/`, none of them introduced by the release
workflow. Thirty-one were fixed outright.

The last twenty-one were one sniff in one file, and are **suppressed per line
with their reason**. `WordPress.DB.PreparedSQL` matches the literal variable
`$wpdb`, and `src/Database/WpdbConnection.php` holds the handle as
`$this->wpdb`, so every prepared query in it reported five findings apiece — one
per argument — and no restructuring reaches the sniff without costing something
the class exists for. The argument is written out above the first of them, for
the wp.org reviewer who asks the same question.

**An `--ignore-codes` list is still refused**, and the two are not one
concession a layer apart. A list on the runner sits away from the code and
applies to files nobody was thinking about when it was written; an annotation is
scoped to a single line, visible where the question arises, and disappears when
the code moves.
[ADR 0029](docs/adr/0029-the-free-contract-is-proven-at-the-source.md) records
which form is sanctioned and why, and `bin/plugin-check.sh` gained no flag.

### Why WordPress 6.8

Free and Pro require WordPress **6.8 or later** and PHP **8.1 or later**. The
bundled Action Scheduler 4.1.0 sets the WordPress minimum. Normal activation,
admin boot and editor smoke checks passed on WordPress 6.8 and 7.1.1; see the
[compatibility review](docs/reviews/2026-09-20-content-lock-compatibility.md).
The artifact check compares the packaged dependency requirement with the plugin
header, and verifies that the Free readme agrees.

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
read like flaky tests rather than a broken database. It is a `server` flag only
— the `php` subcommand below rejects it.

### Proving the two replacements on a real WordPress

Two `bin/verify-*.php` scripts assert what a recording stub structurally cannot:
that after the swap **nothing can put free's script back**. `WP_Dependencies` is
a graph, and a dequeued-but-still-registered handle is resolved and printed as
the dependency of anything queued — so a stub that re-implemented `all_deps()`
would make itself the authority on what WordPress does.

```bash
# runner.php, mounted at /scratch:
#   require_once '/wordpress/wp-load.php';
#   WConvert\Bootstrap::container()->resolve(WConvert\Database\Installer::class)->install();
#   require '/wordpress/wp-content/plugins/wconvert/bin/verify-admin-replacement.php';

npx @wp-playground/cli php --php=8.1 \
  --mount "$PWD:/wordpress/wp-content/plugins/wconvert" \
  --mount "$PWD/pro:/wordpress/wp-content/plugins/wconvert-pro" \
  --mount "$PWD/../mu:/wordpress/wp-content/mu-plugins" \
  --mount "$PWD/../scratch:/scratch" \
  -- /scratch/runner.php
```

The mu-plugin `require`s both plugin files, because `activate_plugin()` takes
effect on the *next* request — a script that activates and carries on runs
against a WordPress that loaded neither.

`bin/verify-loader-replacement.php` is the same shape for the front-end loader.
Both **decline** rather than fail when Pro is absent or its bundle is missing:
the replacement is the thing under test, so a site without it is one the script
has nothing to report on.

**And the degrade rule is worth running by hand**, because it is the one that
protects a merchant from a bad unpack: move `pro/public/admin/` aside and load
the WConvert screen. Free's bundle must still be there — dequeuing free's while
pointing at a bundle that is not there renders a blank `<div>` with a 404 in a
console nobody has open.

### Booting with MailPoet, and without it

The MailPoet [[Destination]] has two cases and **both are worth running**: it is
`ready` where MailPoet is installed and `unavailable` where it is not, and the
second is the majority of real sites. `bin/verify-destinations.php` asserts
whichever one it is booted into, so the two runs are one script and two
blueprints.

MailPoet is not installed in any Local site. Pull it in rather than hunting for
a copy:

```json
{
  "$schema": "https://playground.wordpress.net/blueprint-schema.json",
  "preferredVersions": { "php": "8.1", "wp": "latest" },
  "steps": [
    {
      "step": "installPlugin",
      "pluginData": { "resource": "wordpress.org/plugins", "slug": "mailpoet" },
      "options": { "activate": true }
    }
  ]
}
```

Pass it with `--blueprint`, and leave the step out — or the flag off — for the
absent case. MailPoet runs on Playground's SQLite despite being a Doctrine ORM
application, so this needs no MySQL either.

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
  --blueprint "$PWD/../scratch/with-mailpoet.json" \
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

## Content lock (Pro)

See the [Content lock setup guide](docs/guides/content-lock.md) for the two block
workflows, screenshots, supported content and troubleshooting.

Use Content lock for a public bonus, checklist, or article section revealed after
form submission. In Display rules → Placement choose **Content lock**, use a
complete inline capture journey, then publish. In your WordPress
post/page, add **WConvert Lock from here** after the public introduction. Choose
the Campaign in the block settings sidebar, then write ordinary blocks below the
divider. Everything below it, including content added later, belongs to the lock.
Moving or removing the divider preserves those content blocks.

For a bonus followed by a public conclusion, use **WConvert Content lock** instead
and put only the bonus inside that section. Both blocks use the sidebar Campaign
picker, with Change and Clear actions for an existing selection. Use one lock per
page. No separate end marker is needed for the section block.

The classic editor equivalent is
`[wconvert_content_lock id="CAMPAIGN_ID"]Your content[/wconvert_content_lock]`.
Keep both shortcode tags around the complete region; do not split them between widgets.

Test the published page in a fresh browser, submit, then reload. Access is remembered
for 30 days for that Campaign family in the same browser. Reuse the same Campaign
on several pages to share that access. Another device or an existing subscription
elsewhere is not recognized. Display rules, frequency limits, unavailable Pro,
missing JavaScript or technical capture failures can leave the content readable.
Ordinary field validation keeps the form available for correction.

Support is for standard post/page content with text, static images, lists, tables
and links. Place media embeds, interactive forms and scripts outside. After
changing campaigns or plugin availability, clear page/CDN caches and check the real
page; cached HTML can retain its previous payload. Review the Inspector and Privacy
Data map for the active behavior and site-scoped `wcv_unlock1:` storage.

This is promotional gating: HTML and download URLs are public. Use a dedicated
access-control system for private files or paid membership. Review your excerpts,
feeds and search presentation; WConvert does not generate restricted-content
schema or guarantee indexing outcomes. The [research and implementation plan](docs/plans/165-inline-content-locking.md)
records competitor documentation, supported scenarios and deferred capabilities.
