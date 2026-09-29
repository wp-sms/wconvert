# Spam protection precedes capture and stays separate from contact state

WConvert includes local form protection and optional Turnstile, reCAPTCHA v2
checkbox and hCaptcha integrations in Free. Every paid install inherits them.
Merchants supply their own provider keys; no external service is enabled on
installation, and provider charges are separate from a WConvert licence.

## Capture boundary

The public endpoint checks the honeypot and existing per-address/per-campaign
request allowance before issuing a capture grant. When a provider is configured,
it returns a challenge instruction instead of a grant until server-side
verification succeeds. The signed grant binds the campaign, capture contract,
and current protection configuration. Changing keys or enabling a provider
invalidates earlier grants; cached pages cannot bypass the new requirement.

One verified grant authorizes one existing capture journey, whose transaction
and request hashes still serialize accepted submissions and replay. CAPTCHA
verification is not repeated for a lost capture response or the journey's
optional second signup. A challenge token alone never accepts a submission.
Provider tokens and form answers are never put in URLs or diagnostics.

Verification checks strict success, the site's configured hostname for Google
and Turnstile, and Turnstile's capture action. hCaptcha authenticates the
configured sitekey in the verification request; its informational hostname may
be absent under load and is not used as authentication, per its documentation.
The reCAPTCHA adapter explicitly refuses score-bearing responses: v3 needs a
separately designed response to uncertain scores, rather than treating any
successful token as a good score. WordPress forwards no contact fields or raw
IP address to Siteverify. The provider's browser code receives network/browser
information independently and is disclosed in the privacy map and policy guide.

An outage, malformed provider response or invalid credentials is unavailable
verification, not a spam verdict. The form keeps values and allows retry.
Unverified requests never become Leads or trigger Destinations. No silent
fail-open mode and no false success acknowledgement are offered.

## Browser integration

The existing forms use closed shadow roots, modal dialogs and popovers. A
provider can place challenge overlays outside its widget, where the parent's
modal could make them inert. A same-origin verification document isolates these
provider overlays. It is displayed in a temporary modal only after submission
requires verification. Its parent accepts messages from that exact frame and
origin, then sends the token to the existing capture endpoint.

Only one configured provider loads, inside that document. It cannot collide
with another WordPress plugin's CAPTCHA globals. The small host/verification
bundle is loaded on demand, with bounded baseline loader costs
documented below. Closing verification preserves the original form. The document has
no-store headers and same-origin framing restrictions; secrets never enter it.

## Free and Pro

Free supplies the honeypot, request limit, provider adapters, protected grants,
resource-email send guard, setup test, and approximate protection diagnostics.

The `spam-filters` Pro module supplies exact email/domain blocklists and exact
email exceptions. Lists are opt-in, capped at 100 entries each, site-wide and
case-normalized. No wildcard, free-mail, role-address, geographic or VPN blanket
blocking is inferred. Exceptions bypass those email rules only, never CAPTCHA
or rate limits. Phone-only submissions are unaffected.

Paid code lives solely in its module directory and is present on all paid
rungs. If configured filters outlive their module, capture refuses until the
merchant restores Pro or explicitly removes the unavailable filters. Absence
must not silently broaden an authored protection policy.

## Resource email abuse

Independent captures still create independent Leads (ADR 0021). Queued
lead-magnet sends additionally serialize a ten-minute window for a site-HMAC of
recipient and resource URL in an existing WordPress option. A second send is
skipped; it is not counted as delivered, nor treated as a destination outage.
A failed mail attempt does not consume the window. Explicit admin test sends
are outside this automatic-send guard. Different resources remain independent.

This amends ADR 0008's assumption that organic capture needs no sending limit.
The guard is a bounded abuse safeguard, not an exactly-once mail-delivery
promise: a process/database failure after a mail transport accepts a message
can still leave an uncertain outcome. No contact suppression lifecycle is added.

## Storage and diagnostics

No table or column is added. Settings live in one non-autoloaded option with
write-only secrets in admin responses. Sending keys contain only a site-HMAC;
expired keys are pruned by the existing submission recovery schedule, in
bounded batches, with compare-before-delete protection against a renewed key.
WordPress cron delays can retain expired keys longer than their active window.

A 24-hour transient holds a fixed set of approximate counters: hidden-field
refusals, request limits, failed/unavailable/successful verification, email-rule
refusals and suppressed resource sends. Read-modify-write totals can lose
increments under concurrency; they are operational hints, not billing,
conversion analytics, counts of people, or proof that every refusal was spam.
The existing request limiter is also a best-effort WordPress transient limit;
it is not a substitute for host/edge volumetric protection.

External bot verification is a protection integration, not a Destination. The
Free/Pro outbound Destination boundary remains unchanged (CONTEXT.md).


## Measured loader-budget amendment

After merging ADR 0110's campaign events, native module loading and the shared
capture-request helper produce 14,423 / 24,926 / 26,502 / 26,753 bytes gzip-9
for Free / Basic / Pro / Elite. The combined features exceed their previous
ceilings by 87 / 94 / 134 / 129 bytes. Reserve 256 bytes per rung for this
pre-capture boundary: new hard limits are 14,592 / 25,088 / 26,624 / 26,880.
This is a bounded 0.96–1.79% ceiling increase, with no opt-out. Provider scripts
and the isolated verification UI still load only when needed; their larger
cost is not included in these baseline loader figures. Phone, payload and
per-design limits are unchanged. Native module loading replaces a separate
script-element cache/retry mechanism, and both journeys share one challenge
handshake in `capture-request.ts`. A failed verification never fires the
campaign capture event.
