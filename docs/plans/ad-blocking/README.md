# Ad-block compatibility and audience targeting

Status: implemented on the ad-blocking branch, 2026-09-29. The detector has
been checked with clean pages and a synthetic cosmetic filter in real browser
engines; coverage against live blocker extensions remains unverified. This
document records the product scope and its limits. The
[plan audit](../../reviews/ad-blocking-audit.md) records the remaining merge
and release checks. It does not authorize a release.

## Outcome

Help merchants establish whether WConvert can load and receive requests in
their browser, then let them show an appropriate Campaign when a limited
ad-block check detects interference.

Deliver in this order:

1. Measure existing compatibility and capture reproducible failures.
2. Improve Free diagnostics and isolate analytics transport failures.
3. Add optional ad-block audience targeting to the existing Pro targeting module.
4. Consider configurable delivery paths only if measured failures justify them.

Diagnostics and targeting answer different questions. A detector reporting
interference does not prove WConvert was blocked. A working WConvert Campaign
does not prove the browser has no blocker. No percentage of all blocked visitors
or recovered revenue can be inferred from these checks.

Companion documents:

- [Runtime and product contract](contract.md)
- [Implementation slices and verification](implementation.md)
- [Merchant support procedure](../../guides/ad-blocking.md)

## Baseline before this implementation

| Area | Current behavior | Gap |
| --- | --- | --- |
| Delivery | `src/Frontend/LoaderEnqueue.php` serves a local loader and emits local capture/beacon REST URLs. Pro replaces the loader. | No blocker-specific compatibility mode; local delivery can still be filtered. |
| Rules | `resources/rules/manifest.json` defines audience conditions; `pro/modules/premium-triggers/` supplies advanced targeting. | No ad-block rule or detector. |
| Inspection | `resources/loader/src/inspect/arrival.ts` inspects script/payload tags and ordering. | A script tag is not evidence that its code ran. |
| Analytics | `resources/loader/src/beacon.ts` uses `sendBeacon`, with fetch only when that API is absent. | Queue refusal is ignored; a synchronous throw can escape; successful queueing is not receipt. |
| Capture | `src/Lead/JourneyCapture.php` records accepted captures and applicable conversions on the server. | Capture still requires the request to arrive. Browser-counted impressions/clicks remain susceptible to loss. |
| Storage | Functional state already falls back from localStorage to cookies to memory. | Storage denial must not be interpreted as ad blocking. |

These baseline findings are based on source inspection, not a browser
compatibility test. The implemented changes and remaining qualification work
are recorded in [implementation evidence](implementation.md#implementation-evidence-2026-09-29).

## Product decisions implemented

- **Free:** delivery diagnostics, safer analytics transport, and any later
  justified delivery compatibility fix.
- **Pro targeting:** rule tier `pro`, inherited by `elite`, within the existing
  `premium-triggers` module. The internal `basic` build does not acquire it.
  Use actual tier availability; all paid rungs currently display as “Pro.”
- Author the new rule under **Display → Audience → Specific visitors**.
  It is a Condition, not an Opening moment or a new Campaign Goal.
- Choices: **Ad blocking detected** and **Ad blocking not detected**.
  Neither is selected automatically when the row is added.
- Detection is optional, bounded, local to the current document, and activated
  only when a served Campaign needs the rule.
- Treat pending and inconclusive checks as unknown. Neither authored choice
  matches unknown; an independent matching OR branch may still qualify.
- Preserve ordinary priority, scheduling, consent, frequency, dismissal,
  completion, explicit-click and Reopen semantics. No automatic priority boost.
- Keep Campaigns dismissible. Do not introduce an ad-block wall, repeated
  disable-blocker prompts, or an automatic change to existing Campaigns.
- No tables, columns, visitor identifiers, persistent detector state, or
  ad-block analytics dimension are needed.

Suggested merchant use: a newsletter invitation or an ad-free membership offer
for an audience with detected blocking. Use existing Goals and real conversion
actions. A click on “How to allow this site” is not proof that blocking stopped.
New bundled designs/playbooks are a separate optional follow-up through the
repository's design-authoring workflow.

## Competitor evidence

Reviewed 2026-09-29. These are documented capabilities, not independently tested
claims about detection coverage.

| Product | Documented behavior | Decision it informs |
| --- | --- | --- |
| [OptinMonster](https://optinmonster.com/docs/how-to-create-a-campaign-to-target-adblock-users/) | Growth audience targeting; recommends custom domains and acknowledges workarounds are not foolproof. | Separate targeting from delivery; avoid absolute protection claims. |
| [Convert Pro](https://convertpro.net/docs/how-can-i-create-an-adblock-detection-popup-with-convert-pro/) | Detection launch option, combinable with a page-load delay. | Support the use case through Audience plus existing Opening controls. |
| [FireBox](https://www.fireplugins.com/docs/triggers/adblock-detect/) | Pro detection trigger. | Supports offering advanced targeting in the paid tier. |
| [Popup Maker](https://wppopupmaker.com/docs/getting-started/popup-maker-settings-cheat-sheet/) | Optional custom/random names for JavaScript and analytics routes. | Consider delivery changes only after identifying actual path-based failures. |

WConvert already serves its own assets from the WordPress installation, so a
SaaS-style custom-domain feature is not the proposed starting point.

## Release boundaries

The first release can ship diagnostics independently of targeting. Targeting
ships only after the browser evidence supports the stated limited behavior and
the existing byte budgets pass. Configurable delivery paths are outside that
release unless the baseline reveals a concrete need and their separate design
is completed.

No unverified claim of “ad-block proof,” “all blockers detected,” exact lost
visitors, or recovered advertising income should appear in the UI or release
copy. The feature observes local interference with a test, not installed
extension identity.
