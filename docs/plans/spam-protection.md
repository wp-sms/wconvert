# Spam protection delivery plan

## Product decisions

Protect legitimate submissions first. Built-in protection works without an
account. External verification is optional and uses merchant-owned keys.
Standard CAPTCHA integrations belong in Free; Pro adds explicit lead-quality
policies. Rejected requests are not stored as leads or labelled as confirmed
spam. WConvert still does not own double opt-in or contact lifecycle state.

## Implemented scope

| Free and Pro | Pro module |
| --- | --- |
| Existing field/body validation, signed capture grants and 60-request/10-minute per-IP/campaign limit | Exact email-domain blocklist |
| Hidden-field trap outside the captured-field vocabulary | Exact email-address blocklist |
| Turnstile Managed, reCAPTCHA v2 checkbox, hCaptcha | Explicit email-address exceptions |
| Server-side token/hostname/action validation | Maximum 100 entries per list |
| Lazy isolated verification UI, cancel/retry without clearing fields | Site-wide scope, clearly shown in settings |
| Write-only secret updates and explicit saved-setup test | Saved policies cannot silently disappear if Pro is absent |
| Ten-minute repeated resource-email guard | Included on every paid rung |
| Bounded, approximate diagnostics and privacy disclosures | No tier check on the visitor frontend |

The implementation decision is [ADR 0110](../adr/0110-spam-protection-precedes-capture.md).

## Deferred phases

These are deliberately not advertised as current features:

1. Email typo suggestions with explicit acceptance; maintained disposable-domain
   intelligence with update provenance and merchant exceptions; campaign-level
   policy overrides and a policy preview.
2. reCAPTCHA v3 with measured score distributions and a recoverable challenge
   path for uncertain results. Never silently discard on a generic threshold.
3. Merchant-selected OOPSpam or mailbox-verification integrations, with separate
   provider pricing, timeouts, quota handling and disclosure of transmitted data.
4. A review queue only after deciding storage, retention, replay semantics,
   original consent preservation and exactly which side effects release triggers.
   Basic recovery accompanies any filter that holds submissions; advanced bulk
   investigation can be paid. No new Lead/Contact lifecycle is implied.

No custom AI classifier, mandatory country/VPN blocking, automatic address
rewriting, duplicate-lead deletion, or default block on Gmail/role addresses.

## Verification

- Unit tests: key secrecy/rotation, strict provider responses, hostname/action
  binding, network errors, no v3-score bypass, Pro rule validation and absence,
  diagnostic minimization, repeated-send outcomes.
- Browser-unit tests: frame/origin checks, cancellation, value preservation,
  settings save failure, Free provider availability, existing Free/Pro journeys.
- Real WordPress/MySQL: `bin/verify-spam-protection.php` on an explicitly isolated
  test installation, with HTTP intercepted so no real provider or recipient is
  contacted. Tests protected captures and replay against real transactions.
- Browser smoke: saved-setup test and a protected popup submit through the real
  WordPress endpoints; provider widget/network verdicts simulated.
- Production setup still needs merchant-owned keys and a successful setup test
  on the merchant's hostname. No live vendor account has been configured here.

The [verification record](../reviews/spam-protection-2026-09-29/verification.md)
includes runtime checks and reviewed screenshots.

## Operational notes

Use Settings → Spam protection. Select a provider, register the site's hostname
with it, save its keys, and run **Test saved setup**. Google keys must be v2
checkbox keys; hCaptcha keys must support the standard widget; Turnstile should
be Managed. Keep host/edge rate protection for attacks that saturate PHP before
WordPress can respond. See [the setup guide](../guides/spam-protection.md).
