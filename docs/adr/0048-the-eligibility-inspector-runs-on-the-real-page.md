# The eligibility inspector runs on the real page, and the decision has one spelling

A merchant asking *"why didn't my popup show?"* is asking about a page. WConvert
answers it by **opening that page**: an administrator visits
`https://site/pricing?wconvert-inspect=1` and a panel appears beside the real
[[Optin]]s, reporting for every Optin on the site exactly where it stopped.

Two rules make it trustworthy, and everything else here follows from them.

1. **The [[Request Context]] is the served one, not a reconstruction.** The
   merchant does not describe a URL — they visit it.
2. **The decision has one spelling.** `decide.ts` is not modified, not
   duplicated and not re-implemented; the inspector wraps each evaluator to
   record its answer and then calls the real `decide()`.

## Why a URL cannot be described

`RequestContextFactory` cannot build a `RequestContext` from a URL **and must
not be made to**. All seven fields come from conditional tags about *the current
query*, and `path()` reads `$_SERVER['REQUEST_URI']`. Every way of faking one is
dishonest exactly where merchants ask:

- **`url_to_postid()` returns 0** for archives, terms, the blog index and the
  WooCommerce shop page. `archivePostType` would be permanently `null`, so the
  screen would explain — confidently — a page nobody is on. Those are precisely
  the pages whose Targeting is hardest to reason about.
- **A loopback request** breaks on staging, on basic auth and behind a firewall,
  and it cannot render the signed-out variant from a signed-in session anyway.
- **Faking the main query** means re-implementing WordPress's rewrite
  resolution, which is the thing WordPress *is*.

So the context is not *equivalent to* the served one, it **is** it. The ordinary
loader runs beside the panel, unaware of it: the merchant watches the popup
actually fire while reading why.

### The question this cannot answer, and says so

*"What does a logged-out visitor see?"* is **unanswerable and is reported rather
than faked**. The merchant is signed in — that is what grants them
`manage_options` — so a `logged_in: false` rule is reported as a fact about
*this* request: *"It shows only to signed-out visitors. You are signed in, so it
is not showing to you."* Never simulated.

*Asked a second time, and answered the same way, by
[#92](https://github.com/navidkashani/wconvert/issues/92)'s `role` predicate —
which is the sharper version of the same limit. The merchant opened this panel
by being an administrator, so **"what does a subscriber see" is not merely
unknown, it is unknowable from here**: the account they are signed in as is the
only one this request has. So the report carries both halves — the roles the
Optin WANTS and the ones this request HOLDS — under a `roles` key beside
`logged_in` in the inspector's JSON tag, and the sentence names the first:*
"It shows only to visitors holding one of these roles: subscriber. You are
signed in as somebody else."

*It is its own reason (`wrong_role`) rather than a third arm of the sign-in
sentence, because the two send a merchant to different places: one is a setting
they can read off their own account, and this is a fact about the account they
happen to be signed in as. And `logged_in` is named FIRST where an Optin wants
both — a signed-out visitor holds no role, so naming the roles would send them
to a list when what they needed was the question above it.*

*The one thing that is NOT reported is the roles' display names. Those are a
fact about the install, so naming them would mean shipping the whole offered
map into a bundle that carries no `@wordpress/i18n` at all, for a sentence one
Optin in a hundred prints. The slug is what is stored and what an administrator
recognises.*

## Why the decision has one spelling

`resources/loader/src/inspect/explain.ts` builds a `Map` of wrapped evaluators
and hands it to the real `decide()`:

```ts
const verdict = decide({ ...decision, evaluators: watched });   // the ONE spelling
```

`Standing` is therefore never re-derived, and drift between the panel and the
page is **structurally impossible rather than test-enforced**. The short-circuit
in `conditions.every()` is not worked around — it *is* the answer to which
condition failed. Rules `decide` skipped are filled in afterwards, where an
answer cannot change a verdict already taken.

**Three answers per rule, never two:** `true`, `false`, and **`null` for not
evaluated**. That third one is mandatory. `blocked` means *not evaluated, not
failed*, and a red cross against a rule a consent plugin withheld teaches the
merchant to go and fix a rule that is perfectly fine.

The server half has the same rule one language over:
`WConvert\Targeting\TargetingExplainer` takes its verdict from
`TargetingEvaluator::matches()` and adds only the per-rule table beneath it.
That is the table [ADR 0005](0005-the-rule-model-is-three-flat-closed-axes.md)
predicted — *"a flat list yields a readable per-rule pass/fail table"* — and
never built.

**Nothing in the production graph changes.** `npm run check:loader` prints
byte-identical numbers before and after this work; a non-zero delta means
something leaked into the loader and the change is wrong.
`tests/js/inspector-parity.test.ts` walks the import graph from each loader
entry and asserts it never reaches `inspect/`.

## Rejected

**A debug mode in the shipped loader** — rejected on the **leak**, not the
bytes. `window.wconvert.candidates` behind a guessable query parameter exposes
campaign ids and rule state on a page that may sit in a public full-page cache,
and a capability check cannot rescue it:
[ADR 0004](0004-the-loader-survives-optimizers-not-just-caches.md)'s reasoning, recorded on
`Routes::canCapture()`, already says why nothing baked into a cached page
authenticates anyone. Here the capability is checked in PHP, on an uncached
request, before a byte is printed.

**A server-side re-implementation** — it needs a `RequestContext` from a URL,
and it re-spells `standingOf`'s order plus four evaluators in PHP against
signals PHP does not have: `matchMedia`, `performance.now()`, scroll position. A
"simulated visitor state" form makes the merchant supply the answer to their own
question.

**A REST route** — and that is load-bearing rather than incidental. Four tests
assert exact route counts (`DestinationRoutesTest`, `BeaconControllerTest`,
`CaptureControllerTest`, `BuilderRoutesTest`) and
`CoreServiceProvider::REST_CONTROLLERS` is asserted complete; inlining the
server half at enqueue moves none of them. `current_user_can()` at enqueue
answers the permission question a `permission_callback` would, on a request that
is being rendered *for this user* rather than fetched by a page that may itself
be cached.

## Consequences

- **The gate is outside the REST layer**, so it gets a test of its own:
  `tests/unit/Frontend/InspectorLeakTest.php`. A logged-out visitor and a
  subscriber get **no tag and no script** — not a hidden panel, not a filtered
  one. The report names every Optin on the site, published and draft, with the
  Targeting rules the ordinary payload deliberately strips.
- **[ADR 0005](0005-the-rule-model-is-three-flat-closed-axes.md) is amended**, inline.
  Targeting is now sent to the browser on an admin-gated, parameter-gated,
  uncached request. The ordinary payload still carries none of it.
- **Every merchant word is minted in PHP** (`InspectorLabels`) — and the reason
  is the BUNDLE, not `make-pot`. The admin translates in TypeScript perfectly
  well (`builder/rules/sentence.ts` does, reaching `wp.i18n` through
  `wp_set_script_translations`). The inspector cannot: it is composed from the
  loader's own module set, which has no dependencies at all (ADR 0004), so it
  carries no `@wordpress/i18n` to translate with. The panel is handed a
  dictionary and spells no merchant-facing word of its own. For the same
  reason its templates carry **one `%s` and never two** — a single
  `String.replace` is what a bundle with no formatter can do honestly.
- **[[Pro]] replaces the inspector on the hook it replaces the loader**, and it
  is not optional. Pro's loader beside free's inspector would report every
  `exit_intent` Optin as `inert` — *"it has no trigger this site can fire"* —
  about Optins that work. A diagnostic that is confidently wrong is worse than
  none, because the merchant acts on it.
- **The funnel names a gate the product has no word for.** `arbitrate()`
  silently drops a `ready` overlay when a higher-priority one won, and "ready
  but not shown" is what a merchant is actually looking at. It is derived from
  `verdict.show` against the standing — **not an eighth `Standing`** — and it
  names the WINNER rather than saying "priority", because two overlays at equal
  priority are broken by the ULID and telling a merchant they lost on priority
  when both were zero sends them to change a number that decides nothing.
- **The panel gets out of the way of focus**, which is more than being small.
  WCAG 2.2 SC 2.4.11 (Focus Not Obscured, AA) says a focused element must not be
  *entirely* hidden by author content. Capping the panel at 60vh and putting it
  in a corner is necessary and is not sufficient — measured on a real page, it
  occupied 9% of the viewport and still buried three of the theme's own
  navigation links completely. So it collapses the moment focus lands somewhere
  it covers, and does **not** restore itself: content that pops back is content
  the criterion is still about. Re-measured against the live box afterwards:
  zero.
- **A cache can still beat it.** `DONOTCACHEPAGE` is set during PHP, and a
  full-page cache holding a file for that URL answers before PHP runs at all. In
  practice the `wordpress_logged_in` cookie bypasses full-page cache in every
  mainstream plugin — which is why the admin bar works on the front end — and
  where a host caches for signed-in visitors the symptom is *no panel and no
  admin bar*. The dialog that offers the link is where that is said, because a
  warning inside a panel that did not render is one nobody can read.
- **`tests/unit/Database/SchemaTest.php` passes untouched.** Nothing here stores
  anything.

## What this amends, and where to read it

`docs/agents/domain.md` asks for both directions, every time — the amending ADR
names what it amends, and the amended one names what amends it. This is that
side of it.

- **[ADR 0005](0005-the-rule-model-is-three-flat-closed-axes.md)** — *"never
  sent to the browser"* is now almost true, and the exception is the tag
  described above. It also built the per-rule table 0005 predicted and nobody
  had written.
- **[ADR 0047](0047-site-wide-frequency-is-the-same-shape-at-a-second-scope.md)**
  — the per-Optin authoring surface it assumed already existed did not. It
  landed with this work, and `src/Optin/Frequency.php` is the shape its second
  scope reuses.
- **[ADR 0039](0039-a-screen-is-regions-and-scope-decides-placement.md)** —
  extended: scope decides where a FACT goes as well as where a control goes. A
  fact identical for every item in a group belongs to the group.
- **[ADR 0050](0050-a-scheduled-optin-stays-in-the-published-set.md)** is the
  other direction and arrived later: it added the funnel's eleventh gate,
  `schedule`, and took this ADR's one-`%s` rule at its word. The panel cannot
  spell *"3 days"* — it carries no `@wordpress/i18n`, which is this ADR's own
  consequence — so the **magnitude is minted in PHP** with `human_time_diff()`
  and carried per Optin like the suspension sentence beside it, while the
  DIRECTION is derived in `explain.ts` on the same clock reading `decide` was
  given. That split is what makes it impossible for the two halves to disagree
  about which side of a boundary the visitor is on.

- **[ADR 0026](0026-a-goal-the-site-cannot-serve-is-hidden.md)**
  is APPLIED rather than amended. The `unavailable` rules panel branch is the
  rendering it already required and nothing had built.
