# 0143: The License page and the updater

Date: 2026-10-12. Status: accepted; lands in six slices, one pull request
each, so a decision below may describe code a later slice brings.
Amends [0015](0015-enforcement-is-by-non-registration.md) (no licence read
anywhere; the SDK as a private repository; Nexus serving a tier-matched ZIP) and
[0056](0056-the-tier-ladder-is-a-manifest.md) (no licence read; Nexus matching
a licence to a tier).

Pro customers need to activate, renew, manage their sites and receive updates
through Nexus, which runs at **https://my.wconvert.io**. ADR 0015 reserved this
work — put the SDK in Pro only, gate updates on it, narrow
`NoLicenceOnTheFrontEndTest` — and this records how it was done. The approved
clickable prototype is the review gate: claude.ai/artifact/EovSgYnM27kRV686LKGgWP
(v3).

## What does not change

**A licence never changes what Pro does.** The build is the gate (ADR 0015,
ADR 0056): a capability is present because it shipped in the ZIP. A licence buys
updates and support. Every problem state on the License page says "Pro features
keep working", and no code path outside `pro/src/License/` reads a licence —
`NoLicenceOnTheFrontEndTest` holds it to that directory and to Pro's bootstrap,
which runs its provider and stops its daily check on deactivation and asks it
nothing, and asserts no file on the front-end read path touches it.

## Decisions

1. **The SDK is in Pro only, scoped.** `pro/composer.json` (Pro's first) pins
   `veronalabs/wp-premium-sdk` to **exactly `1.0.0-beta.8`** — the gaps below
   are worked around against that version, so a newer beta is a deliberate
   upgrade. The package is public and fetched over HTTPS; ADR 0015's "private
   repository" blocker is gone. wp-scoper copies it to `pro/packages/` under
   `WConvert\Pro\Deps`, and `pro/src/autoload.php` requires that classmap
   unconditionally. The build strips `vendor/` whole, and the artifact contract
   (check g) refuses a Pro ZIP without the scoped SDK, or with an unscoped one,
   as it already refused a free ZIP with any.
2. **The SDK's module loader and its admin-ajax endpoints are unhooked.** The
   loader would switch code on by licence, and the build already decided; the
   endpoints would be a second door beside our REST (decision 6) without its
   managed-key refusals or its masking. `WCONVERT_NEXUS_URL` points the SDK at a
   staging store.
3. **Store and plans.** Store slug `wconvert`, catalog item `wconvert-pro`.
   Nexus calls them tiers; WConvert calls them **plans**, because they are not
   the rungs of `tiers.json`: `single-site` (1 site), `5-sites` (5),
   `unlimited`. No trial, no lifetime price. `installed_tier` is deliberately
   **not** configured, so the SDK's tier-mismatch offer stays inert. Releases
   post the elite ZIP once per plan slug, since Nexus keys a release by
   `(catalog item, tier_slug, version)`. Plan slugs stay out of `tiers.json`,
   which ships in free.
4. **Storage is the SDK's own.** One non-autoloaded option,
   `wconvert_pro_license`, plus the SDK's transients and one 60-second check
   throttle. No table.
5. **Updates are gated, and flushed only on a real change.** Pro moves its own
   entry to `no_update` when the licence does not entitle it, and drops the
   update caches only when the activation, status, expiry, plan or site count
   change — the option is rewritten on every check, and most writes mean
   nothing to the updater. A port of WSMS @530317f79.
6. **Our own REST, not the SDK's AJAX.** `wconvert/v1/license` wraps the SDK's
   public manager methods and copies the behaviour its endpoint classes carry
   (the managed-key refusals, the updater flush). Raw keys never reach the
   browser; the buyer's name is masked.
7. **Placement.** No nav tab. A WP submenu WConvert → License (the first item
   renamed *Campaigns*) and the header plan badge link to `#license` on the
   existing `admin.php?page=wconvert` page, registered through a generic
   `registerPage()` slot in free that names neither Pro nor licences. The badge
   carries an amber or red dot with a hover reason, and reads "Activate Pro"
   with no licence. The bell is untouched: it belongs to notifications.
8. **The page.** One status card — headline, one action, then Updates · Support
   · Renewal, with updates and *Check now* in its foot — then a Sites card and a
   License key card.
   The payload's `state` is one of `none`, `active`, `expiring`, `cancelled`,
   `manual`, `lifetime`, `trial`, `trial_ended`, `expired`, `payment_failed`,
   `disabled`, `over_limit`, `moved`, `copy`, `key_unreadable` — decided once,
   in `LicenseState`, in the prototype's order (whatever stops updates first).
   A failed payment is read from Nexus's renewal block (`state:
   payment_failed`), because the licence's own status stays `active` through
   the grace period, which runs past the renewal date. A key the store
   refused (the SDK's `invalid`) stops updates like any other stopped
   licence. `UpdateGate` asks the same model, so the Plugins screen and the
   page never disagree about whether updates are on. `GET ?check=1` asks the
   store at most once a minute. The account's sign-in belongs to the
   administrator who started it; another gets `sign_in_other_user`. Moving
   a licence without saying whether to keep the old site leaves that to the
   SDK, which frees the old seat only when this domain holds one.
9. **Agency (managed) mode.** `WCONVERT_LICENSE_KEY` in wp-config turns it on. The
   client sees only whether updates are on and who manages the licence
   (optional `WCONVERT_LICENSE_CONTACT`, `'Acme Studio <help@acme.studio>'`).
   Every other detail is **redacted server-side** — the state itself is reduced
   to `active` or `stopped` — every mutating route answers 403
   `key_from_constant`, and nothing reminds anyone. A wp-config key the store
   refused shows its code and when the SDK retries it.
10. **Multisite.** Pro refuses network activation, as free does. Each subsite
    holds its own licence; there is no network page. Deleting Pro still visits
    every site of a network to release its seat (WP Statistics' uninstaller,
    budget and all), because per-site activation is allowed.
11. **Only an administrator finishes a sign-in.** The account sign-in's return
    parameters are dropped on `admin_init` at 9 unless the user has
    `manage_options` (veronalabs/wp-premium-sdk#28; a port of WSMS's guard).
12. **Freeing a site before activating** links to the portal in v1 ("Manage
    sites ↗"); the in-place version waits on the SDK.

## Upstream gaps, and the workaround each ships with

Filed on `veronalabs/wp-premium-sdk` (and one on Nexus) before any code:
rotated salts make `getLicenseData()` fatal (WConvert reads the store and shows
"key unreadable" instead); a new key orphans the old seat (`replace` activates
first, then releases); unknown statuses fold into `invalid` (WConvert derives
grace and trial from the raw renewal fields); the updater keeps its own offer
for an invalid licence (decision 5); there is no change event (decision 5); the
key travels in the manifest's GET query; `refreshStatus()` has no throttle (the
60-second one above); and #28 (decision 11).

## Consequences

- A checkout needs `composer install -d pro` before Pro boots or its tests run;
  CI does it in every PHP job and in the visual build.
- Expired customers still get free's updates from wp.org while Pro stays at its
  version. A max-core rule for that is a later decision.
- WP-CLI (`wp wconvert license …`) is later.
