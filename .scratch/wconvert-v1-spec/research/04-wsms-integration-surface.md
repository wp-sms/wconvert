# Ticket 04 — WSMS integration surface

**Primary source.** All citations are paths relative to the WSMS 8 plugin root:
`/Users/navidkashani/Local Sites/wsms8/app/public/wp-content/plugins/wp-sms-premium`
Read at WSMS `8.0-beta.5` (`wp-sms.php:6`, `src/constants.php:8`).

---

## 1. Answer

WConvert should couple to the **PHP container service `contact.repository`**, resolved through the global accessor `\WSms\Bootstrap::get('contact.repository')` (`src/Bootstrap.php:160-163`), behind a thin WConvert-owned adapter — and it should do so knowing that **nothing in WSMS 8 is an intended, promised third-party ingestion API**. There is no documented public API: `src/functions.php` is headed "These are the new v8 public API functions" and contains zero functions (10 lines, `src/functions.php:1-10`); the legacy third-party surface in `compat/` is explicitly a fatal-error shim whose `Newsletter::addSubscriber()` returns `false` (`compat/functions.php:1-8`, `compat/classes/Newsletter.php:24-27`); and the project's own conventions file states "**No backward compatibility, deprecation shims, or migration paths are needed — change schemas, APIs, and interfaces directly**" (`AGENTS.md:1-2`). The REST alternative does not solve the coupling problem it appears to solve: `POST /wsms/v1/contacts` is gated on `current_user_can('manage_options')` or `wsms_manage_audience` (`src/Rest/ContactController.php:73` → `src/Rest/Controller.php:45-48` → `src/Access/AccessManager.php:103-115`), so an anonymous front-end lead capture fails the permission callback whether it goes over HTTP or through `rest_do_request()` — it is an admin console API, not an ingestion API. The trade-off, stated plainly: **coupling to `ContactRepositoryInterface::create()` binds WConvert to a first-party interface that WSMS has explicitly reserved the right to break without notice, in exchange for the only surface that can actually accept a Lead at capture time; the mitigation is not to pick a different surface (there isn't one) but to isolate the call behind one adapter class, feature-detect before every call, and fall back to Standalone on any failure.**

---

## 2. Surfaces found

### 2.1 PHP repositories — `ContactRepository` (the only real ingestion path)

**What it does.** Direct row-level CRUD on `{prefix}wsms_contacts`.

**Entry point.**

```php
// src/Contact/Contracts/ContactRepositoryInterface.php:11
public function create(array $data, bool $suppressEvents = false): string;   // returns ULID
```

Implementation `src/Contact/ContactRepository.php:24-56`. Accepted keys and their handling (`:30-46`):

| key | handling | citation |
|---|---|---|
| `email` | `strtolower()`, **no validation** | `:32` |
| `phone` | `self::normalizePhone()` → `PhoneValidator::assertE164()`, **throws** if not already `+E.164` | `:33`, `:693-696`, `src/Support/PhoneValidator.php:66-78` |
| `first_name`, `last_name` | passthrough | `:34-35` |
| `wp_user_id` | passthrough, no auto-link | `:36` |
| `status` | default `'subscribed'` | `:37` |
| `email_verified`, `phone_verified` | cast to 0/1 | `:38-39` |
| `channel_opt_outs`, `custom_fields` | `wp_json_encode` | `:40-41` |
| `source` | default `'manual'` (VARCHAR(50)) | `:42`, `src/Database/Migrator.php:242` |
| `source_ref` | nullable (VARCHAR(100)) | `:43`, `src/Database/Migrator.php:243` |

**Required fields: none.** `create([])` inserts a row with null email and null phone. The REST arg schema marks nothing `required` either (`src/Rest/ContactController.php:74-87`), and `extractContactData()` does no presence check (`src/Rest/ContactController.php:454-464`). Validation that a Lead carries *something* is the caller's job.

**Duplicate behaviour.** `email` and `phone` each carry a `UNIQUE INDEX` (`src/Database/Migrator.php:247-248`; phone was promoted to unique in migration v4, `src/Database/Migrations/Steps/V4PhoneUnique.php:13`). `Connection::insert()` maps a `Duplicate entry` failure to `DuplicateKeyException` (`src/Database/Connection.php:62-84`), which `create()` catches and rethrows as `ConflictException` naming the colliding field (`src/Contact/ContactRepository.php:47-49`, `:703-715`). **There is no upsert.** A repeat lead from the same email throws. (MySQL unique indexes do not constrain NULLs, so many contacts with a null email are permitted — WConvert must not rely on the index to dedupe phone-only leads against email-only ones.)

**Is there a subscribe/opt-in method distinct from a raw insert?** Three, none of them a clean fit:

1. **`SubscriptionHandler::submit(SubscriptionForm $form, array $data): SubmissionResult`** (`src/SubscriptionForm/SubscriptionHandler.php:32-82`) — the real opt-in path. It does honeypot (`:44-46`), consent gate (`:49-54`), email/phone validation (`:59-65`), find-by-email-then-phone (`:67-73`), tag application (`:75`, `:379-384`), and branches to `handleExistingContact()` (`:120-204`) or `handleNewContact()` (`:276-309`) with double-opt-in support. It is the only code that does fill-empty-only PII merge so an unauthenticated submission can never clobber stored PII (`:157-164`, `:217-239`). **But** it requires a persisted `SubscriptionForm` entity — WConvert would have to make the merchant create and maintain a WSMS subscription form, and inherit its opt-in channel, double-opt-in setting and success message. Container id `subscription_form.handler` (`src/Container/SubscriptionFormServiceProvider.php:17-21`).

2. **`OptOutManager::optIn(string $phone, string $channel = 'sms'): void`** (`src/Messaging/Inbound/OptOutManager.php:227-230`) — **the idempotent create-or-opt-in that two first-party premium modules actually use** to turn a consent event into a Contact: WooCommerce checkout consent (`premium/modules/woo-commerce/src/Consent/MarketingConsentService.php:279-281`, comment: *"Creates the contact if absent, clears any prior SMS opt-out, and fires ContactOptedInEvent — the same path admin/keyword opt-in uses"*) and Ultimate Member registration consent (`premium/modules/ultimate-member/src/Consent/UmMarketingConsent.php:115-116`). Internally it resolves by phone, creates with `source => 'sms_optout'` if absent, else clears the channel opt-out (`:264-312`). Container id `messaging.optout_manager` (`src/Container/MessagingServiceProvider.php:129-135`). **Limitations that disqualify it as WConvert's primary call:** phone-only (non-phone channels return early, `:256-262`); it throws on a non-E.164 identity via `normalizePhone` (`:264`); it carries no email, no name, no `source_ref`, no custom fields; and the row it creates is stamped `source = 'sms_optout'`, which would misattribute every WConvert lead.

3. **`CreateContactAction::execute(array $payload, array $config): ActionResult`** (`src/Integration/Contact/Actions/CreateContactAction.php:108-208`) — the closest thing in the codebase to a documented upsert contract: `on_duplicate` ∈ `fail|update|skip` (`:98-104`), find-by-email (`:118-123`), find-by-phone (`:125-131`), auto-links a WP user when the email matches (`:150-155`), and converts the create race into a clean failure (`:157-162`). It is a Flow action, reachable only through the flow engine — but **its `execute()` body is the algorithm WConvert's adapter should copy.**

**Auth/registration.** None. Plain PHP call once WSMS is loaded.

**Stability.** Interface-typed (`ContactRepositoryInterface`, 30 methods) and injected everywhere, so it is the most stable-shaped thing on offer — but it carries no `@api`/`@public` marker and no compatibility promise, and `AGENTS.md:1-2` explicitly disclaims one. Treat as **first-party internal that happens to be interface-shaped**.

### 2.2 REST — `wsms/v1`

**Namespace.** `wsms/v1`, single version, no v2 (`src/Rest/Controller.php:26`, `src/Rest/RestRoute.php:18`).

**`POST /wsms/v1/contacts`** — `src/Rest/ContactController.php:70-88`, callback `store()` (`:240-252`). Permission callback: `$this->canManageSection('audience')` (`:73`), which returns a closure over `AccessManager::canManageSection()` (`src/Rest/Controller.php:45-48`), which is `current_user_can('manage_options') || current_user_can('wsms_manage_audience')` (`src/Access/AccessManager.php:103-115`).

**Answer to the ticket's specific question:** a plugin calling `rest_do_request()` internally **does not** satisfy this. `rest_do_request()` bypasses cookie/nonce checks but runs the permission callback unchanged, and the callback consults `current_user_can()` against whoever is logged in *for the current request*. On a front-end lead capture that is user 0. The endpoint would only pass when a capability-bearing admin happens to be the one submitting. Over real HTTP it needs cookie+nonce or an application password belonging to a user with the capability — i.e. WConvert would have to store WSMS admin credentials to write to a plugin on the same server. `/contacts/bulk`, `/contacts/import`, `/tags/*` and `/lists/*` are gated identically (`src/Rest/ContactController.php:94,106,113,120`; `src/Rest/TagController.php:26-54`; `src/Rest/ListController.php:43-95`).

**`POST /wsms/v1/subscribe/{slug}`** — the *one* unauthenticated write endpoint: `'permission_callback' => '__return_true'` (`src/Rest/SubscriptionFormPublicController.php:39-53`). It routes into `SubscriptionHandler::submit()` (`:97`). Constraints: the slug must resolve to an existing **active** `SubscriptionForm` (`:132-141`); rate limited 5 requests / 60 s keyed per client IP (`:71`, `src/Auth/RateLimiter.php:56-72`); captcha-gated when the merchant enables captcha for the `subscribe` action (`:81-84`, `src/Auth/CaptchaGuard.php:33-58`). Viable only if WConvert is willing to make "a WSMS subscription form exists and is named in WConvert's settings" a configuration prerequisite, and to inherit that form's double-opt-in and consent semantics.

**`POST /wsms/v1/webhook/{id}`** — `src/Rest/WebhookReceiverController.php:25-32`. Auth is HMAC-SHA256 over the raw body against a per-webhook secret in the `x-webhook-signature` header (`:34-53`), secret read from the `WebhookIntegration::SECRETS_OPTION` option (`:37`). It only fires `do_action('wsms_webhook_received', …)` (`:70-75`), which the `webhook.inbound` Flow trigger picks up (`src/Integration/Webhook/Triggers/InboundWebhookTrigger.php:12`, `:32-59`). So it creates nothing by itself — it needs the merchant to have built a Flow ending in a `create_contact` action. Same-server HTTP round-trip for a call that could be a function call.

**Stability.** Versioned in the URL, and the controllers are the one place with a real exception→HTTP contract (`src/Rest/Controller.php:56-98`: 404/422/409/503/500). But the namespace has never been bumped and `AGENTS.md:1-2` covers it too.

### 2.3 Events — `EventDispatcher`

**Entry points.** `src/Event/Contracts/EventDispatcherInterface.php:15,17`:

```php
public function dispatch(object $event, bool $isolateListeners = false): object;
public function listen(string $eventClass, callable $listener, int $priority = 10): void;
```

Implementation `src/Event/EventDispatcher.php:33-72`. Container id `event.dispatcher` (`src/Container/EventServiceProvider.php:13`).

**Third-party subscription.** Two ways, and the second is explicitly for outsiders: `listen()` takes any callable (`:68-72`), and **every** dispatch is bridged to a WP action — `do_action('wsms_' . snake_case(ShortClassName), $event)` (`:61-65`, comment: *"Bridge to WordPress hooks for external extensibility"*). So `ContactOptedInEvent` also fires `wsms_contact_opted_in_event`. A second plugin can absolutely subscribe.

**But it is not an ingestion point.** `ContactOptedInEvent` (`src/Event/Events/ContactOptedInEvent.php:9-38`) is constructed with `contactIds` — ULIDs of contacts that **already exist** — plus phone/source/gatewayId/keyword/channel. It is emitted *after* `OptOutManager` has already done the writing (`src/Messaging/Inbound/OptOutManager.php:314-342`). Nothing in the dispatch path creates or updates a Contact. Dispatching one yourself would notify the webhook emitter and the Flows trigger about contacts that do not exist. Its consumers are the outbound webhook map (`src/Webhook/WebhookEventMap.php:27`, `:309`) and Flow triggers.

**Verdict: viable as a read/notify surface, useless as a write surface. WConvert is one-way outbound and does not read Contact state, so it has no use for it at all.**

### 2.4 Hooks / filters

Full sweep of `do_action(` and `apply_filters(` across `src/` and `premium/`.

**Contact-lifecycle actions — all outbound notifications, none an ingress:**

| hook | fired at | signature |
|---|---|---|
| `wsms_contact_created` | `src/Contact/ContactRepository.php:52` | `($id, $data)` — suppressible via `create(..., true)` (`:51`) |
| `wsms_contact_updated` | `src/Contact/ContactRepository.php:123`, `:546`, `:666` | `($id, $data)` |
| `wsms_contact_status_changed` | `src/Contact/ContactRepository.php:121` | `($id, $oldStatus, $newStatus)` |
| `wsms_contact_tagged` | `src/Contact/ContactRepository.php:268` | `($contactId, $tagId)` |
| `wsms_subscription_form_submitted` | `src/SubscriptionForm/SubscriptionHandler.php:201`, `:306` | `($contactId, $formId, $data)` |
| `wsms_subscription_confirmed` | `src/SubscriptionForm/SubscriptionHandler.php:115` | `($contactId, $formId)` |

**Registration hooks — plainly intended for third parties, and the only such family:**

| hook | fired at | args |
|---|---|---|
| `wsms_register_extensions` | `src/Extension/ExtensionServiceProvider.php:22` | `ExtensionRegistry` |
| `wsms_register_integrations` | `src/Container/IntegrationServiceProvider.php:139` | `IntegrationRegistry, TriggerRegistry, ActionRegistry` |
| `wsms_register_gateways` | `src/Container/MessagingServiceProvider.php:356` | `GatewayRegistry` |
| `wsms_register_mfa_channels` | `src/Container/MfaServiceProvider.php:199` | `manager, container` |
| `wsms_register_social_providers` | `src/Container/SocialServiceProvider.php:109` | `manager` |

Both contact-relevant ones are wrapped in a `try/catch(\Throwable)` that `error_log`s and continues (`src/Extension/ExtensionServiceProvider.php:21-25`, `src/Container/IntegrationServiceProvider.php:138-142`) — a registrant that fatals does not take WSMS down with it.

**`wp_sms_loaded`** (`src/Bootstrap.php:137`) is the one hook with a docblock naming third parties: *"Fires after WSMS core is fully loaded. Premium and third-party code should hook here. @since 8.0"* (`:130-136`). It fires on `plugins_loaded` @10 (`:115`).

**Documented?** Only `wp_sms_loaded` carries a `@since`/audience docblock. Every other hook above is undocumented, and `changelog.md` contains no hook-, API- or extension-compatibility statement (its four "backward compatibility" mentions are unrelated: `changelog.md:61`, `:262`, `:352`, `:385`). `docs/` holds three historical integration *roadmaps* (`docs/woocommerce-integration-roadmap.md:3-9` marks itself "Historical document"), not an extension guide.

**No filter anywhere lets a third party inject a contact.** There is no `apply_filters` in the contact write path at all.

### 2.5 `ExtensionRegistry`

**Entry point.** `src/Extension/ExtensionRegistry.php:17-34`:

```php
public function register(array $extension): void;
// keys: id (required, silently dropped if empty :19-23), name, description,
//       version, type (default 'addon'), requires, page
```

**What registering actually buys — the complete list:**

1. An entry in `GET /wsms/v1/extensions`, itself gated on `canManageSection('settings')` (`src/Rest/ExtensionController.php:22-26`, `:29-35`).
2. A card on the WSMS admin **Extensions** screen (`resources/react/src/pages/extensions/index.tsx:107-120`).
3. If `page` is present, a click-through renders a **server-declared admin page**: `PageRenderer layout={ext.page.layout} title={ext.page.title}` (`resources/react/src/pages/extensions/index.tsx:60-87`). The `page` payload is `{title, icon?, layout: LayoutNode[]}` where `LayoutNode.component` is a closed union of `'form'|'table'|'tabs'|'stats'|'status'|'alert'|'text'|'actions'`, each pointing at REST `endpoint`s you supply (`resources/react/src/lib/api.ts:291-309`). So `page` mounts a declarative admin screen inside WSMS, driven by WConvert's own REST endpoints.
4. A `hasExtensions` boolean in the admin bootstrap payload (`src/Service/Assets/AssetManager.php:101`).

**That is all.** No behaviour, no data access, no contact write, no lifecycle callbacks.

**Existing registrants to copy: zero.** Grepping the whole tree for `wsms_register_extensions` finds only the `do_action` itself (`src/Extension/ExtensionServiceProvider.php:22`). The empty-state copy — *"Extensions add social providers, MFA channels, and other capabilities"* (`resources/react/src/pages/extensions/index.tsx:102`) — describes an intent that nothing has yet exercised.

**Verdict: a UI mounting point, correctly guessed. Useful to WConvert as a *presence marker* ("WConvert is connected to WSMS") and optionally as an admin page, but irrelevant to pushing a Lead.**

### 2.6 Integration contracts

**Entry point.** `IntegrationInterface` (`src/Integration/Contracts/IntegrationInterface.php:7-44`) — 14 methods: `getId/getName/getDescription/getCategory/getIcon/isAvailable/getAuthType/getAuthSchema/getTriggers/getActions/getCapabilities/boot/connect/disconnect/isConnected`.

**Declarable capabilities** (`src/Integration/Contracts/IntegrationCapability.php:9-19`): `contact_sync`, `list_management`, `campaigns`, `automations`, `transactional_email`, `suppression_sync`, `engagement_data`, `tags`, `webhooks`, `email_gateway`, `contact_import`.

**Direction matters, and it cuts against WConvert:**

- `SupportsContactSync` (`src/Integration/Contracts/SupportsContactSync.php:7-18`) is **WSMS → external ESP** push (`pushContact`, `pushContactBatch`, `removeContact`, `updateContactStatus`, `getFieldMapping`). Implemented by EmailOctopus and Mailtrap. Wrong direction.
- `SupportsContactImport` (`src/Integration/Contracts/SupportsContactImport.php:7-28`) is **external → WSMS** pull: `importOne($externalId, $config, $suppressEvents)`, `getImportBatch($config, $batchSize, $afterCursor)`, `countImportable($config)`. This is the only inbound capability, and it is a **batch/cursor poll model** wired by `IntegrationServiceProvider::wireImportSync()` (`:148`) and `ImportAutoSyncCoordinator` (`:255-257`) — not a push-on-capture path. WConvert would have to expose its Lead log as a pollable cursor and wait for WSMS's schedule.

**Is there an intended path for an external plugin to register as an integration?** On paper yes: `do_action('wsms_register_integrations', $registry, $triggers, $actions)` (`src/Container/IntegrationServiceProvider.php:139`), fired inside `add_action('init', …)` at default priority 10 (`:43`). Triggers registered there get wired by `FlowRunner::subscribeActiveTriggers()` at `init` @30 (`src/Container/FlowServiceProvider.php:275-277` → `src/Flow/Engine/FlowRunner.php:59-66`), so the timing works for a registrant hooking on `plugins_loaded` or `wp_sms_loaded`.

**In practice, nobody uses it.** No registrant exists anywhere in the tree. Every premium module — WooCommerce, BuddyPress, Ultimate Member, Bookings, WooSubscriptions, ScheduledCampaigns — bypasses the hook and pulls the registry straight out of the container: `$container->get('integration.registry')` (`premium/modules/woo-commerce/src/WooCommerceModule.php:249-251`, and identically at `premium/modules/buddy-press/src/BuddyPressModule.php:58`, `premium/modules/ultimate-member/src/UltimateMemberModule.php:71`, `premium/modules/bookings/src/BookingsModule.php:353`, `premium/modules/woo-subscriptions/src/WooSubscriptionsModule.php:82`, `premium/modules/scheduled-campaigns/src/ScheduledCampaigns.php:47`). A hook-based registrant must also hand-replicate the private `registerIntegration()` helper (`src/Container/IntegrationServiceProvider.php:260-278`) — including the non-obvious rule that triggers and actions are only registered when `isConnected()` returns true (`:268-275`).

**Verdict: real, structurally sound, entirely untested by any consumer. Attractive as the *merchant-configurable* half of WConvert's story (register a `wconvert.lead_captured` trigger so merchants build "lead captured → create contact / send welcome SMS" flows), but it cannot be the capture path — it depends on the merchant having authored a Flow.**

---

## 3. Scoping and loading

**php-scoper scopes vendor dependencies only. WSMS's own `WSms\…` classes are NOT prefixed.**

- `composer.json:43-47` — first-party autoload is plain PSR-4 `"WSms\\": "src/"`.
- `composer.json:56-69` — `extra.wp-scoper`: `namespace_prefix: "WSms\\Dependencies"`, and an explicit **allow-list of 7 vendor packages** (`firebase/php-jwt`, `spomky-labs/otphp`, `bacon/bacon-qr-code`, `symfony/expression-language`, `symfony/uid`, `league/csv`, `lbuchs/webauthn`), plus `veronalabs/wp-premium-sdk` under the `premium` profile. Target `packages/`, `delete_vendor_packages: true`.
- Proof in the generated artifacts: `packages/autoload-classmap.php` contains 356 `WSms\Dependencies\…` entries and **zero** `WSms\Contact\…` entries; `packages/autoload.php:19-39` registers a plain PSR-4 map `'WSms\\' => __DIR__ . '/../src'`.
- The scoped names are committed into first-party source — e.g. `src/Contact/ContactRepository.php:6` imports `WSms\Dependencies\Symfony\Component\Uid\Ulid`.
- Action Scheduler is deliberately left unprefixed as a shared library (`wp-sms.php:125-133`).

**Practical consequences for a second plugin:**

1. **`\WSms\Contact\ContactRepository`, `\WSms\Bootstrap`, `\WSms\Contact\Contracts\ContactRepositoryInterface` are the real, stable class names.** No prefix to guess, no version-dependent namespace.
2. **The autoloader is global, not isolated.** `packages/autoload.php:7-17` and `:20-39` are two ordinary `spl_autoload_register()` calls, required from `wp-sms.php:113-123`. Once WSMS has loaded, any plugin in the same PHP process resolves `\WSms\…` for free. WConvert needs no autoloader of its own for WSMS classes and must never bundle a copy.
3. **`vendor/` is stripped from the shipped ZIP** (`.distignore:28`), so production always runs off `packages/autoload.php`.
4. **`WSms\Dependencies\…` is off limits.** Those names change whenever WSMS re-scopes or bumps a dependency. Never type-hint one, never construct one.
5. **Two editions ship the same `WSms\` classes and are mutually exclusive** — free `wp-sms/wp-sms.php` and premium `wp-sms-premium/…`, with premium silently deactivating free on activation (`wp-sms.php:88-106`, `:177-190`). **Never detect WSMS by plugin path or `is_plugin_active()`.** Detect by class/container.

**Global accessors** (`src/Bootstrap.php:145-171`):

```php
\WSms\Bootstrap::container(): ServiceContainer
\WSms\Bootstrap::get(string $id): mixed   // returns null for unknown ids
\WSms\Bootstrap::has(string $id): bool
```

`ServiceContainer::get()` returns `null` rather than throwing for an unregistered id (`src/Container/ServiceContainer.php:96-112`), so a `has()`-then-`get()` pair is safe. The legacy accessor `WPSms()` returns `null` (`compat/functions.php:12-17`) — do not use it.

**Container ids WConvert may need:** `contact.repository`, `contact.tag_repository`, `contact.list_repository` (`src/Container/ContactServiceProvider.php:20-32`); `subscription_form.handler` (`src/Container/SubscriptionFormServiceProvider.php:17`); `messaging.optout_manager` (`src/Container/MessagingServiceProvider.php:129`); `integration.registry`, `flow.triggers`, `flow.actions`; `extension.registry` (`src/Extension/ExtensionServiceProvider.php:14`).

---

## 4. Recommendation

### Chosen surface

**`\WSms\Bootstrap::get('contact.repository')`, typed against `\WSms\Contact\Contracts\ContactRepositoryInterface`, called from exactly one WConvert class** (e.g. `WConvert\Sink\WsmsSink`). No other WConvert file may name a `WSms\` symbol.

The adapter's `create-or-update` must replicate `CreateContactAction::execute()` (`src/Integration/Contact/Actions/CreateContactAction.php:108-208`), because `ContactRepositoryInterface::create()` has no upsert:

1. Require at least one of email / phone — WSMS will not (`src/Rest/ContactController.php:454-464`).
2. Normalise phone to `+E.164` **in WConvert**, before the call. `create()` throws `\WSms\Exception\ValidationException` on anything else (`src/Contact/ContactRepository.php:33`, `:693-696`, `src/Support/PhoneValidator.php:66-78`). Use `\WSms\Support\PhoneValidator::isE164()` to pre-check if you want, but own a local fallback so the capture path never depends on it.
3. `findByEmail()` then `findByPhone()` (`src/Contact/Contracts/ContactRepositoryInterface.php:22,27`).
4. If found → `update()` with fill-empty-only semantics (copy `SubscriptionHandler::fillEmptyPii()`, `src/SubscriptionForm/SubscriptionHandler.php:217-239`) — a public form submission must never overwrite stored PII it does not own.
5. If not found → `create([...])` with `source => 'wconvert'` and `source_ref =>` the WConvert form/page identifier.
6. Catch `\WSms\Exception\ConflictException` (the lookup→insert race, `src/Contact/ContactRepository.php:47-49`) and treat it as success-with-existing, exactly as `CreateContactAction` does (`:157-162`).
7. Wrap the whole thing in `catch (\Throwable)` → log locally, mark the Lead `wsms_push_failed`, **never** let it surface to the visitor.

**Status choice.** Default to `status => 'pending'` unless the WConvert form captured explicit marketing consent. `ContactStatus::Pending` exists precisely for "in the book, but not marketable — we hold this person's details without permission to market to them", and `neverMarketable()` excludes it from every marketing audience unconditionally (`src/Enums/ContactStatus.php:11-35`, `:52-55`). Writing `'subscribed'` for a bare lead capture would put an unconsented address into the merchant's next campaign. Note the one asymmetry: a `pending` contact whose `source` is not `'subscription_form'` **can** be promoted by an inbound START (`src/Enums/ContactStatus.php:78-90`), which is the correct behaviour for a WConvert lead.

### Fallback if unavailable

**Standalone (local Lead log) is the default state, not the error state.** Order of operations in the capture path:

1. Write the Lead to WConvert's own table. Always. First.
2. *Then* attempt the WSMS push, and only if feature detection passes.
3. A failed push is a flag on the local row, never a failed capture.

This satisfies the "WSMS must never be a runtime requirement" constraint by construction: the sink is a post-write side effect.

### Feature-detection strategy

Check all three, in this order, **immediately before each push** (not once at boot — WSMS can be deactivated mid-session, and its container only fills on `plugins_loaded` @10, `src/Bootstrap.php:115`):

```php
class_exists(\WSms\Bootstrap::class)                                  // plugin present, either edition
    && \WSms\Bootstrap::has('contact.repository')                     // container booted (ServiceContainer.php:141-148)
    && \WSms\Bootstrap::get('contact.repository')
         instanceof \WSms\Contact\Contracts\ContactRepositoryInterface // shape is what we compiled against
```

Add a **version floor** against `WP_SMS_VERSION` (`src/constants.php:7-9`) — note it is a beta string (`'8.0-beta.5'`), so compare with `version_compare($v, '8.0', '>=')` and expect pre-release semantics. `WP_SMS_PREMIUM_LOADED` (`wp-sms.php:44`) distinguishes the premium overlay but is irrelevant here: Contacts live in free core (`ContactServiceProvider` is in the core provider list, `src/Bootstrap.php:76`).

Hook WConvert's own wiring on **`wp_sms_loaded`** (`src/Bootstrap.php:137`), the only hook WSMS documents for third parties (`:130-136`), with a `plugins_loaded` fallback for the WSMS-absent case.

### Optional, additive (v1.1, not v1)

- **`wsms_register_extensions`** (`src/Extension/ExtensionServiceProvider.php:22`) — register `{id: 'wconvert', name, description, version, requires}` so WConvert shows on the WSMS Extensions screen. Costs ~10 lines, buys discoverability, risks nothing (the `do_action` is `try/catch`-wrapped, `:21-25`). Skip the `page` key in v1.
- **`wsms_register_integrations`** (`src/Container/IntegrationServiceProvider.php:139`) — register a `WConvertIntegration` exposing a `wconvert.lead_captured` trigger, so merchants can build "lead captured → send welcome SMS" flows. This is the *right* long-term shape and is genuinely additive to the direct write. It is untrodden ground (zero registrants) and should not gate v1.

### What WConvert must NOT touch

- Any `WSms\Dependencies\…` class.
- `\WSms\Database\Connection`, `Migrator`, or the `wsms_*` tables — directly, or via `$wpdb`. `AGENTS.md:4-15` makes schema a sign-off matter for WSMS's own maintainers; a second plugin writing those tables is out of the question.
- `ContactRepository` the **concrete class** — always type against `ContactRepositoryInterface`.
- `create($data, true)` — the `$suppressEvents` flag exists for the one case where a row is a tombstone rather than a signup (`src/Messaging/Inbound/OptOutManager.php:278-289`). A WConvert lead **is** a signup; suppressing `wsms_contact_created` would silently break the merchant's welcome automation, their `contact.created` webhook and their ESP sync — the three listeners that comment names.
- The `compat/` layer entirely (`compat/functions.php:1-8`, `compat/classes/Newsletter.php:24-27`).
- `\WSms\Bootstrap::container()->register()` / `singleton()` (`src/Container/ServiceContainer.php:58-75`) — never mutate WSMS's container.
- `EventDispatcher::dispatch()` with a WSMS event class. WConvert must not forge `ContactOptedInEvent`; the event carries ids of contacts that already exist (`src/Event/Events/ContactOptedInEvent.php:15`).
- `OptOutManager::optIn()` as the primary write — it is phone-only, drops email/name/metadata, and stamps `source = 'sms_optout'` (`src/Messaging/Inbound/OptOutManager.php:264-273`).

---

## 5. Clearly internal — do not couple to

| Symbol / surface | Why | Citation |
|---|---|---|
| `WSms\Dependencies\*` (all) | Vendor code re-namespaced by php-scoper; names change on any dependency bump | `composer.json:56-69`, `packages/autoload-classmap.php` |
| `WSms\Database\Connection`, `Migrator`, `Migrations\Steps\*` | Schema is under an explicit sign-off rule for WSMS's own maintainers | `AGENTS.md:4-15`, `src/Database/Migrator.php:228-254` |
| `wsms_contacts` / `wsms_tags` / `wsms_lists` tables | Same | `src/Database/Connection.php:19`, `src/Database/Migrator.php:230-253` |
| `ContactRepository` (concrete), `ListRepository`, `TagRepository` | Use their `Contracts/` interfaces instead | `src/Contact/ContactRepository.php:15` |
| `ContactRepository::normalizePhone()` (public static) | Public only so `OptOutManager` can reach it; throws `ValidationException` | `src/Contact/ContactRepository.php:693-696` |
| `ContactRepository::create($data, true)` | Suppresses `wsms_contact_created`; reserved for opt-out tombstones | `src/Contact/ContactRepository.php:51-53`, `src/Messaging/Inbound/OptOutManager.php:278-289` |
| `SubscriptionHandler` private helpers (`fillEmptyPii`, `verificationTargets`, `resolveTagIds`, `isConsentRequired`) | Private; **copy the logic, do not call it** | `src/SubscriptionForm/SubscriptionHandler.php:217`, `:253`, `:359`, `:404` |
| `IntegrationServiceProvider::registerIntegration()` | Private helper a hook registrant must hand-replicate | `src/Container/IntegrationServiceProvider.php:260-278` |
| `AccessManager` internals / `wsms_*` capabilities | WSMS's own RBAC; WConvert has no business asserting these caps | `src/Access/AccessManager.php:60-115` |
| `ServiceContainer::register()` / `singleton()` | Mutating WSMS's container from outside | `src/Container/ServiceContainer.php:58-75` |
| `compat/` (`WP_SMS\*`, `WPSms()`, `wp_sms_send()`, …) | Explicitly no-ops "solely to prevent fatal errors in old add-ons" | `compat/functions.php:1-8`, `compat/classes/Newsletter.php:24-27` |
| `premium/**` (all modules) | Tier-gated, build-stripped from the free artifact | `wp-sms.php:20-86`, `README.md:12-31` |
| Any `WSms\Rest\*Controller` class | Controllers are wiring, reached via `register_rest_route` only | `src/Container/RestServiceProvider.php:337-385` |
| `EventDispatcher::dispatch()` with WSMS event classes | Events are notifications about work already done | `src/Event/EventDispatcher.php:33-66` |

---

## 6. Open questions / risks

**Risks WConvert carries either way**

1. **No compatibility promise exists.** `AGENTS.md:1-2` states outright that interfaces change directly with no shims. `changelog.md` has no API/hook section. `compat/` proves the precedent: the entire v7 third-party surface was replaced with `return false` stubs. **Any surface WConvert picks can break in a WSMS patch release, and WConvert will find out at runtime.** This is the single most important finding in this ticket and should be reflected in the v1 spec as an accepted risk, not engineered around.
2. **`8.0-beta.5` is pre-release** (`src/constants.php:8`). Interfaces are still moving. A version floor should assume the shape can change before 8.0 final.
3. **`ValidationException` from `create()` on a non-E.164 phone** (`src/Contact/ContactRepository.php:33`) is a hard throw, not a return value. Any WConvert lead whose phone is a national-format number will throw unless WConvert normalises first. `PhoneValidator::canonicalizeStored()` rescues bare digits and `00`-prefixed numbers but explicitly refuses national/trunk-prefixed formats without country context (`src/Support/PhoneValidator.php:33-46`).
4. **Two editions, same classes.** Detection by plugin file will be wrong for half the install base (`wp-sms.php:88-106`).
5. **`create()` accepts an empty contact.** Nothing in WSMS stops WConvert writing a junk row; validation is entirely WConvert's responsibility (`src/Rest/ContactController.php:454-464`).
6. **No test coverage of any third-party path.** Grepping `tests/` for `wsms_register_integrations` / `wsms_register_extensions` returns nothing. Whatever WConvert couples to is unpinned by WSMS's own suite, so a refactor will not fail a test on WSMS's side.

**What a WSMS maintainer would need to confirm or promise**

1. **Will `ContactRepositoryInterface::create/update/findByEmail/findByPhone` and the `contact.repository` container id be treated as stable for 8.x?** If yes, this ticket's recommendation is sound as written. If no, ask for (2).
2. **Ask for a first-class ingestion entry point.** The honest answer to "what is WSMS's intended path for a second plugin to push a lead?" is *there isn't one*. The right thing to request is a narrow, documented, forward-compatible function — the shape already exists three times inside WSMS and only needs to be named once:

   ```php
   // proposed, in src/functions.php — the file that already declares itself
   // "the new v8 public API functions" and is currently empty
   function wsms_capture_contact(array $lead): ?string;
   // upsert-by-email-then-phone (CreateContactAction::execute semantics),
   // fill-empty-only PII merge (SubscriptionHandler::fillEmptyPii semantics),
   // defaults status to 'pending' absent explicit consent,
   // returns the contact ULID or null, never throws.
   ```

   Every ingredient exists: `CreateContactAction::execute()` (`src/Integration/Contact/Actions/CreateContactAction.php:108-208`) is the upsert; `SubscriptionHandler::fillEmptyPii()` (`src/SubscriptionForm/SubscriptionHandler.php:217-239`) is the safe merge; `OptOutManager::optIn()` (`src/Messaging/Inbound/OptOutManager.php:227-230`) is the precedent for a one-line create-or-update helper that two premium modules already depend on.
3. **Should `source` values be registered or namespaced?** `ContactCreatedTrigger`'s filter enum lists `manual|import|sync|flow|api` (`src/Integration/Contact/Triggers/ContactCreatedTrigger.php:76-82`) but the column is a free-form `VARCHAR(50)` (`src/Database/Migrator.php:242`). A `source = 'wconvert'` will not appear in that filter dropdown. Ask whether the enum should become filterable, or whether third parties should use `source = 'api'` with `source_ref` carrying the origin.
4. **Is `wsms_register_integrations` supported, or vestigial?** It has zero registrants and every first-party module deliberately bypasses it (`premium/modules/woo-commerce/src/WooCommerceModule.php:249-251` and five siblings). If it is supported, `registerIntegration()`'s body (`src/Container/IntegrationServiceProvider.php:260-278`) should be made public or the hook should do the wiring itself, so a registrant does not have to know that triggers are silently dropped when `isConnected()` is false.
5. **Is `ExtensionRegistry::register()`'s `page` contract stable?** It is undocumented on the PHP side and its shape lives only in TypeScript (`resources/react/src/lib/api.ts:291-309`). A PHP-side schema constant or docblock would make it safe to target.
6. **Ambiguity worth flagging honestly:** `SubscriptionHandler` carries a known, in-code-documented defect — a contact who replied STOP keeps `status = 'subscribed'`, skips the double-opt-in guard, reaches `clearChannelOptOut()` and is re-subscribed with no confirmation code sent, on a form that promises double opt-in (`src/SubscriptionForm/SubscriptionHandler.php:138-155`). If WConvert ever routes through the subscription-form path instead of the repository, it inherits that. Another reason to prefer the repository plus WConvert's own explicit logic.
