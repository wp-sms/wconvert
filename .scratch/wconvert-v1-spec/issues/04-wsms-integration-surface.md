# WSMS integration surface

Type: research
Status: resolved

## Question

What does WSMS 8 actually expose that WConvert can push a Lead into, and which
surface should WConvert couple to?

Flagged during charting and deliberately deferred: coupling to WSMS's **PHP
classes** is fast and typed but binds WConvert to WSMS internals across two
independent release cycles; coupling to its **REST API** is stable and versioned
but pays HTTP cost for a same-server call and needs auth. There may also be a
hooks/filters surface, or `ExtensionRegistry` may imply an intended add-on path.

Investigate in
`/Users/navidkashani/Local Sites/wsms8/app/public/wp-content/plugins/wp-sms-premium`:

- `src/Contact/` — `ContactRepository`, `ListRepository`, `TagRepository` and
  their `Contracts/` interfaces. What is the supported way to create a contact?
- `src/Rest/ContactController.php` — what does the REST surface offer, and what
  authentication does it require for a same-site server-side caller?
- `src/Extension/ExtensionRegistry.php` and `ExtensionServiceProvider.php` — what
  does registering actually buy an add-on? The `page` key suggests admin
  mounting; confirm what it renders.
- `src/Integration/` — `WpSmsIntegration`, `ContactIntegration`, and the
  `Contracts/` capability interfaces. Is there already an intended path for an
  external plugin to register as an integration?
- `src/Event/` — `ContactOptedInEvent` and friends. Is the event bus a viable
  entry point, and is it public API or internal?
- Whether WSMS is namespaced/scoped (`WSms\Dependencies\…` suggests php-scoper),
  and what that means for a second plugin calling its classes.

Report the surfaces, their apparent stability, and a recommendation with the
coupling trade-off stated plainly. Note anything that is clearly internal.

## Answer

Couple to the **PHP repository**: `\WSms\Bootstrap::get('contact.repository')`, typed
against `\WSms\Contact\Contracts\ContactRepositoryInterface`, called from exactly one
WConvert adapter class. Not because it is stable — it is not — but because it is the
only surface that can accept a Lead at capture time.

**REST is not the safe versioned option it looked like.** `POST /wsms/v1/contacts` is
gated on `current_user_can('manage_options') || current_user_can('wsms_manage_audience')`
(`src/Rest/ContactController.php:73`). `rest_do_request()` runs that callback unchanged
against the current user — user 0 on an anonymous front-end capture. It is an admin
console API, not an ingestion API. The only unauthenticated write is
`POST /wsms/v1/subscribe/{slug}`, which requires the merchant to maintain a WSMS
subscription form and inherits its opt-in semantics, IP rate limit and captcha.

**There is no third-party-intended ingestion surface at all.** `src/functions.php` is
headed "the new v8 public API functions" and is empty; `compat/` is `return false`
stubs; and `AGENTS.md:1-2` disclaims backward compatibility outright — "change schemas,
APIs, and interfaces directly". The coupling trade-off stated plainly: WConvert binds to
an interface WSMS has explicitly reserved the right to break without notice. The
mitigation is not a different surface (there isn't one) but isolation — one adapter,
feature-detect before every call, fall back to Standalone on any failure.

**php-scoper is a non-issue.** Only 7 vendor packages get `WSms\Dependencies\`;
first-party `WSms\` is unprefixed PSR-4 via a global autoloader. Cross-plugin calls just
work. But free and premium ship the same classes and are mutually exclusive
(`wp-sms.php:88-106`) — detect by class/container, never by plugin path.

**Shape of the adapter.** `create()` has no upsert and throws `ConflictException` on a
duplicate email or phone, so copy `CreateContactAction::execute()`
(`src/Integration/Contact/Actions/CreateContactAction.php:108-208`): require at least one
of email/phone, normalise phone to +E.164 in WConvert first (`create()` hard-throws
otherwise), find-by-email then find-by-phone, fill-empty-only PII merge on update, treat
the lookup→insert race as success-with-existing.

**Write order is the constraint that satisfies "WSMS is never a runtime requirement":**
local Lead row first, always; WSMS push second, as a post-write side effect; a failed
push is a flag on the local row, never a failed capture.

**Default `status` to `'pending'`, not `'subscribed'`** (`src/Enums/ContactStatus.php:11-55`),
unless the form captured explicit marketing consent — otherwise bare leads land in the
merchant's next campaign.

**Additive, v1.1 not v1:** `wsms_register_extensions` buys a card on the Extensions
screen for ~10 lines and risks nothing. `ExtensionRegistry` buys only that card, an
optional declarative admin page, and a REST listing — zero registrants exist today.
`wsms_register_integrations` has zero registrants too; all six premium modules bypass it
via the container.

**Ask WSMS for:** a named `wsms_capture_contact(array $lead): ?string` in the already-empty
`src/functions.php`. Every ingredient exists in three places; it only needs naming once.

Full findings, with citations and a do-not-touch list:
[`research/04-wsms-integration-surface.md`](../research/04-wsms-integration-surface.md)
on branch `research/04-wsms-integration-surface`.
