---
name: design-a-playbook
description: Author a new WConvert [[Playbook]] — the words, rules and defaults that prefill an Optin for one [[Goal]]. Use when adding entries to resources/playbooks, or when the goal-first creation flow needs a starting point that does not exist yet.
---

# Designing a Playbook

A [[Playbook]] is a complete starting point for one [[Goal]]: the words, the
[[Trigger]]s, the targeting and the [[Destination]] hint. It names a default
[[Template]] but **is not** one — the design is the Template's job, and the
words are the Playbook's.

**This is the higher-leverage half of the library.** The goal-first creation
flow's second step shows **Playbooks, not designs**, so a merchant coming
through the front door meets these cards and not the gallery. Several useful
starting points may share one design while offering different words and rules.

It is also where the market gap is. 16 of 16 competitors ship a big template
gallery; only about 5 ship **templates with purpose-matched rules**, which the
research marks P0. A Playbook is that.

## The shape

One PHP file per entry in `resources/playbooks/`, each `return`ing an array.

**PHP and not JSON**, which is the whole reason this directory is not
`*.json` beside `resources/templates/library/*.json`: `wp i18n make-pot` cannot
see a string inside JSON, so a JSON bundled registry ships an English-only
library (ADR 0013). Wrap every visible name, note and copy string in `__()`.
Stable ids and choice `value` keys are identifiers, not translated words.

```php
return [
    'id' => 'kebab-case',
    'name' => __('Sentence case', 'wconvert'),
    'goal' => 'grow_email_list',   // one of the six, below
    'template_id' => 'centred-card',
    'notes' => __('Why a merchant would pick this, and what to expect.', 'wconvert'),
    'copy' => [ /* Slot Role => words */ ],
    'rules' => [ ['type' => 'time_on_page', 'seconds' => 8] ],
    'targeting' => [ 'include' => [], 'exclude' => [] ],
    'destination_hint' => ['types' => ['wsms'], 'fields' => ['email']],
];
```

**The Goal is a closed enum of six**: `grow_email_list`, `grow_sms_list`,
`deliver_lead_magnet`, `promote_offer`, `recover_cart`, `collect_enquiries`.
The enquiry Goal is free and standalone; it counts Conversions, not replies,
sales or completed jobs. It adds no Goal/design coupling (ADR 0076).
Adding a case is a code change a reviewer reads. If a Playbook does not fit one, it is
parked, not squeezed in.

## The Playbook declaration is validated at registration

`WConvert\Playbook\PlaybookLibrary` is the **only** place the guarantee lives —
there is no runtime check behind it. Registration is the last moment an author
is present: a rule enforced at prefill reaches you as a merchant's bug report
about a popup with no headline.

A refused entry goes to `_doing_it_wrong()`, so run the suite and read the
output.

### `copy` keys are Slot Roles, and they must be ones the design declares

A Role the Template does not declare is dropped on prefill and nobody is told,
so it is refused here instead. Roles **repeat** and a Playbook supplying an
array fills them **in tree order** (ADR 0051) — three `body` values are three
benefit lines. A single value fills the first slot only.

### Multi-screen copy is scoped

Journeys with more than two screens use `copy.screens`: scope by the submitted
field set (`submission:email`, `submission:phone`, `submission:email-name`),
`screen:<id>` for other screens, and `acknowledgement`. Each scope contains
ordinary Slot Role bindings. Never reuse email consent as SMS consent. Navigation
has its own next/back/skip/close labels. See the four `journey-*` Playbooks.

### No markup, ever. A link is structure.

For the one `interest` choice field, labels and sent values travel together.
Its three derived Roles are `interest_label`, `interest_placeholder` and
`interest_options`. Bind the last as a **named wrapper**, not a bare list that
would mean repeated Role occurrences:

```php
'interest_label' => __('Which service do you need?', 'wconvert'),
'interest_placeholder' => __('Choose a service', 'wconvert'),
'interest_options' => ['options' => [
    ['value' => 'installation', 'label' => __('Installation', 'wconvert')],
    ['value' => 'repair', 'label' => __('Repair', 'wconvert')],
]],
```

Translate the labels, never `installation` or `repair`. A label can change
without changing the answer sent to another service. Stay within the generated
vocabulary's `field_options` bounds; a shipped choice list must be nonempty.
Do not invent field names or provider-specific custom-field ids. Inspect
`resources/playbooks/request-a-quote.php` and ADR 0076 for the complete slice.

A sentence needing a link carries a `%s` and a `{label}`:

```php
'fine_print' => [
    /* translators: %s: the label of a link to the site's privacy policy. */
    'text' => __('No spam, and you can unsubscribe at any time. See our %s.', 'wconvert'),
    'link' => ['label' => __('Privacy Policy', 'wconvert')],
],
```

**Never an `href`.** A link with a label and no destination is asking for the
one destination only the site can name, and the renderer resolves it from
`get_privacy_policy_url()` at render time — so the entry is correct on every
install without knowing which install it is on (ADR 0032). With no policy
configured the link renders **nothing**, never a dead `#`.

### Nothing site-local

Three shapes, one reason: an entry is written once and runs on every install,
so anything naming a row on one of them is wrong everywhere else.

- **A rule param the manifest marks `authored`** — a post id, a term id,
  `click_element`'s CSS selector. Read off the manifest, not listed anywhere.
- **A [[Destination]] id.** `destination_hint` names *types* and the [[Lead]]
  fields needed, and nothing else — including a ULID hiding inside `types`.
- **A privacy-policy `href`**, above.
- **A Slot Role the manifest marks `authored_roles`** — today just
  `code_value`, because a discount code exists in one merchant's WooCommerce
  and nowhere else. The design ships the placeholder and the merchant types
  theirs in (ADR 0061).

### Every Playbook needs a Trigger that could fire

*"Shows immediately"* is the explicit `page_load` rule, not an empty list. An
entry naming none prefills an Optin that can never fire — a total, silent loss
of function.

Watch the shape: an Optin fires when **any** of its Triggers fires, so adding
`page_load` beside `time_on_page` does not back the timer up, it **deletes**
it.

### There is no converting-act check, and there must not be one

ADR 0059 deleted every design↔Goal coupling. A Template offering exactly one
converting act **is** the declaration, enforced at its own registration. A
third party filing a capture design under the sale Goal is offering a start a
merchant can legitimately want, and refusing it would drop the card with
nothing in any log.

`resources/playbooks/README.md` asserted that deleted check for three commits.
Do not put it back.

## Writing the words

The `copy` is what a merchant reads first and edits second, so it is the house
style whether or not anyone meant it to be. `tools/design-library/GUIDELINES.md`
§1 applies here as much as to a design — especially:

- **The trade goes in the headline.** *"Get 10% off your first order"*, not
  *"Join our newsletter"*. Nobody wants the mechanism.
- **The reward is specific.** Not *exclusive offers*, not *great content*.
- **The button says what happens.** *Send my code*, *Get the guide*, *Back to
  my basket* — never *Submit*.
- **Success acknowledges the request.** *Request received* and *Thank you for
  requesting the guide* describe a captured Lead. Do not promise subscription,
  confirmation, a completed send or an inbox-arrival time; those depend on the
  receiving service. A code actually shown in the success step may be described
  as being here. Keep delivery setup prerequisites in `notes` (ADR 0073).
- **Labels name the detail; examples help enter it.** Supply both through the
  field's Slot Roles. A phone example includes the country code. Required
  markers come from the renderer, not a second authored asterisk.
- **Urgency is real or it is absent.** No invented stock counts, no
  unverifiable social proof.
- **The `notes` field earns its place.** It is the one sentence explaining why
  a merchant would pick this card over its neighbour, and it appears on the
  card. Say what to expect, including what is *not* captured.
- British English, sentence case, no em-dashes, nothing site-specific.

## `notes` is where a site-local prerequisite goes

A Playbook cannot carry a schedule, a coupon code or a cart URL — all three are
site-local. Where a design needs one, say so in `notes`:

> a launch-countdown Playbook's `countdown` draws its shape and no time until
> the merchant sets an end date on the Rules tab (ADR 0052), and
> `builder/structure/problems.ts` says so on the screen where it is fixed.

That is the same shape as the privacy link and the cart URL: the plugin
resolves what it can and asks the merchant for what only they know.

For a guide or emailed offer, name the remaining setup in plain words:
*Configure a delivery destination and add the guide before publishing.* Do not
imply that selecting the Playbook already does this. Updating shipped copy
changes the examples and future drafts, never the saved copy in existing
Optins. The success-text inspector explains this boundary for merchant edits.

For an enquiry, explain where the inline block or shortcode belongs and which
service the merchant must configure to follow up. The native service question
is optional in **Request a quote**, alongside optional name and required email.
It records a request; it does not manage quotes, replies or jobs.

Destination notes must describe shipped support, not planned integrations.
MailPoet can send the stable interest value to an existing custom text field
chosen under **Save interest in MailPoet**, for **new subscribers only**.
Existing subscriber fields remain unchanged. WSMS and lead-magnet email do not
forward the choice; the answer remains in WConvert capture history and export.
Never suggest that selecting a Playbook already picks a shared route or mapping.

## Before opening a PR

```bash
composer test    # BundledPlaybooksTest walks the real library; PlaybookRegistrationTest covers each refusal
```

`BundledPlaybooksTest` registers every bundled entry, so a refusal is a red
build rather than a missing card.

And per `CLAUDE.md`: **verify on a real WordPress** — walk the goal-first flow
to step 2 and check the new card reads well beside its neighbours.
