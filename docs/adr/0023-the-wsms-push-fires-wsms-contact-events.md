# The WSMS push fires WSMS's contact events

The adapter calls `ContactRepository::create()` with events **enabled** —
`$suppressEvents` stays `false` — and applies its [[Destination]]'s tags through
`addTag()`, which fires its own event. No setting controls this.

The consequence is accepted rather than mitigated: a merchant running both
WConvert's and WSMS's Mailchimp integrations sends one [[Lead]] to Mailchimp by two
paths. WConvert **detects and explains** that overlap; it does not offer to switch
it off.

## What the events actually reach

`ContactRepository::create()` fires `wsms_contact_created` (`:52`) unless
suppressed, and it has three live consumers:

- **`ContactCreatedTrigger`** — a Flow trigger. The merchant's welcome sequence,
  tagging rules and follow-ups run on a WConvert capture with no work from us.
- **`OutboundWebhookDispatcher`** — a `contact.created` outbound webhook.
- **`OutboundSyncManager`** — forwards the [[Contact]] to **WSMS's own ESP
  integrations**, on create, update, status change *and* tagging (`:36`, `:42-60`).

`addTag()` fires `wsms_contact_tagged` (`:255-269`), which reaches both the Flow
trigger set and `OutboundSyncManager` again.

## Why fire them

This is most of the value of integrating at all. Welcome messages, tagging and
sequences arrive built by the merchant, in the tool that owns those concepts, and
WConvert ships none of it.

Suppressing would make WConvert **the one Contact producer on the site that does not
announce itself.** A Contact appearing with no trace of how is a support ticket, and
it is the same class of mistake as #5's original `pending` default: technically
defensible, silently wrong, discovered by the merchant rather than by us.

## The ESP double-path, named

`OutboundSyncManager` means WSMS re-forwards any Contact it gains. So with
WConvert's Mailchimp Destination (premium,
[#6](https://github.com/navidkashani/wconvert/issues/6)) and WSMS's Mailchimp
integration both configured, one Lead reaches Mailchimp twice.

[ADR 0007](0007-destinations-are-outbound-and-fallible.md)'s idempotent
email-keyed upsert means this is **not duplicate contacts and not corruption**. It
is two systems disagreeing about *which audience* and *which field mapping*,
resolved by whichever queued job runs second.

## Why a setting is the wrong instrument

A toggle does not resolve the disagreement — it relocates it, and it asks the
merchant to decide a race between two queues from a checkbox label. Detection is
strictly better: when WSMS is active with an outbound sync configured, WConvert's
ESP Destination UI says what will happen.

If a switch is ever wanted it belongs on **WConvert's ESP Destination** ("skip if
WSMS already syncs this"). Never on the WSMS push, which is the in-process,
free-tier, zero-outbound-HTTP path #4 depends on and must stay unconditional.

## Tags, not lists

The WSMS Destination's target selector is one or more **tags**. `wsms_lists` is a
segment *definition* — `type` defaulting to `'dynamic'`, a `conditions` JSON, an
optional `tag_id` (`Migrator.php:281-292`, `ListRepository.php:27`) — and
membership lives in `wsms_contact_tag`. **A dynamic list is a query; there is
nothing to insert into.** `CONTEXT.md` said "the WSMS list" and was corrected,
because that wording sends an implementer at a table they cannot write to.

WSMS's own analogous capture path does exactly this: `SubscriptionHandler` resolves
tag ids off the form and calls `applyTags()` (`:75`, `:167`).

Tags are **added, never reconciled** — removing one WConvert did not set is a
lifecycle act. `addTag()` is `INSERT IGNORE` and only fires its event when a row is
genuinely inserted, so repeat pushes are naturally idempotent and do not re-trigger
Flows.

## Provenance rides along

The push sets `source = 'wconvert'` and `source_ref` = the [[Optin]]'s name at push
time. Those columns are filterable (`ContactRepository.php:731-737`), segmentable
(`ContactConditionCompiler.php:61`), rendered (`contact-detail-panel.tsx:121`) and
already backing preset segments (`constants.ts:405-406`) — so provenance lands in
the system that owns the concept and WConvert stores nothing about it.

Not setting it is the actively bad option: the default is **`'manual'`**
(`ContactRepository.php:42`), which makes every pushed Lead look hand-typed.

The name rather than the id, because WSMS can never resolve a WConvert ULID —
WSMS never calls into WConvert — so an id there is permanently unreadable text. It
is a snapshot, like `playbook_id` and the consent text.

**Known gap, WSMS's to close.** `ContactCreatedTrigger::getFilterSchema()` has a
closed `source` enum — `['manual','import','sync','flow','api']` (`:80`) — so a
merchant cannot filter a Flow to "only contacts from WConvert". The Contact is still
created and the unfiltered trigger still fires; only the dropdown is unusable.
`source = 'wconvert'` stays, and widening that enum joins #5's standing ask.
