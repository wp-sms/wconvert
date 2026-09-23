# Country-aware phone fields

Status: implemented on `codex/phone-input-plan` for review. Prepared 2026-09-23.

## Outcome

Visitors can select a country and enter a familiar local phone number. WConvert
formats it and captures one canonical international number. The same field works
in campaign previews, every supported display surface, and progressive journeys.

Use `lite-phone-input` rather than writing international phone parsing ourselves.
Version 0.6.0 is the verified integration baseline. Keep this a Free capability;
paid loaders use the same implementation supplied by the required Free plugin.

## Decisions and recommendations

Confirmed by the user:

- A site-wide starting country, with per-field overrides.
- Support all countries in the library initially. Country restrictions are a
  later feature, not a dropdown-only setting presented as enforcement.
- Download the phone enhancement when a page has a matching phone campaign,
  rather than waiting for the visitor to reach its phone screen.
- Resolve the site default into each published campaign snapshot. A subsequent
  site-setting change affects draft previews and the next publication, not an
  already-published campaign. An explicit field override always wins.

Other recommendations:

- Show the country selector by default and show the dialing code separately.
- Offer a show/hide-selector setting, but do not call it a country restriction.
  Even with the selector hidden, an explicit international number may select a
  different country and update the displayed code.
- Keep formatting automatic; use `strict: false` so ordinary typing is not
  silently truncated either. Show errors instead of removing excess digits.
- No IP lookup, external CDN, visitor country tracking, OTP, or subscription
  verification in this feature. WSMS and other Destinations retain their roles.
- No separate user-facing basic/enhanced mode in the first version. A plain
  international input remains an operational fallback if enhancement fails.
- Do not guess the merchant's market from language, timezone, or IP. An unset
  site default is allowed, but publication of a phone field needs either a valid
  site default or an explicit field country. Non-phone campaigns are unaffected.

## Verified baseline and remaining limits

The published npm package `lite-phone-input@0.6.0` was tested independently in
Chromium 153, Firefox 155, and WebKit 26.6:

- Real mouse search/selection and outside dismissal in a closed shadow root
  inside a native modal work.
- Eighteen international replacement combinations per browser preserve the
  number: three display modes, strict on/off, and `+`, `00`, and Persian digits.
- Disallowed-country and overflow examples preserve digits and report errors.

These are library checks, not proof of integration into WConvert. Saved-profile
browser autofill, physical devices, screen readers, theme interaction, and the
actual WordPress enqueue path still need verification.

The comparable standalone minified build measured 11,937 B JS + 1,075 B CSS,
gzip level 9 (13,012 B total). A WConvert adapter, translations, and theme mapping
will add bytes. The package's existing ESM/CSS files total 13,271 B gzip before
our rebundling. Do not use the npm archive size as the visitor download size.

Sources:

- [Release and upgrade notes](https://github.com/wp-sms/lite-phone-input/releases/tag/v0.6.0)
- [Closed ShadowRoot issue](https://github.com/wp-sms/lite-phone-input/issues/1)
- [International replacement issue](https://github.com/wp-sms/lite-phone-input/issues/2)

## Merchant experience

### Site settings

Add **Default phone country** under Settings → Visitor experience. Use a
searchable country list with names and dialing codes; do not rely on flags alone.
Store the ISO country code in a WordPress option following existing settings
service/REST patterns. No new database tables or columns are needed.

Saving requires the existing administrator capability and REST protection.
Reject unknown codes, rather than letting the widget fall back to the first
country in its dataset. Explain that this is a phone-number interpretation
default, not the visitor's location or a restriction on who may submit.

Until the site default is set, show **Choose a country**. Link to this setting
from a phone field that inherits an unset default. A merchant can alternatively
set an explicit field override without configuring a site-wide value.

### Phone field inspector

Retain label, required/optional, and placeholder controls. Add:

| Setting | Behavior |
| --- | --- |
| Starting country | **Use site default — [country]**, or a specific country |
| Show country selector | On by default; off hides the picker but retains a visible code |
| Example number | Automatic when no custom placeholder is supplied; follows the selected country |

Remove the current instruction that merchants must put an international country
code in every example. A custom placeholder is display text, never input data or
a parsing rule. Warn about misleading custom examples in the editor where
practical; do not overwrite merchant copy silently when a visitor changes country.

The editor shows the resolved country. With the agreed publication snapshots,
it must also explain when a changed site default will take effect at republish.
Do not silently save a campaign just because its preview now resolves differently.

### Drafts, templates, and publication

Proposed field vocabulary (final names should follow existing manifest style):

```json
{
  "type": "field",
  "id": "phone-input",
  "name": "phone",
  "label": "Phone number",
  "required": true,
  "phone_country": "site",
  "phone_country_selector": true
}
```

`phone_country` accepts `site` or a supported uppercase ISO code, and defaults to
`site` for newly authored fields. The selector defaults to true. These parameters
apply only to `name: phone`; do not allow them to affect email/name/interest.

Resolve `site` using the settings service at publication, before saving the
published config, building the published projection, and computing the capture
contract fingerprint. The published field contains an explicit country code.
The capture endpoint and page payload must read the same resolved snapshot.

Template exports retain the authored `site`/override choice; they do not embed a
particular site's default accidentally. Library/gallery examples may use explicit
sample countries. A gallery can show an explicitly labeled demo country when
site settings are unset, but that sample must not become an invisible live default.

Duplication, undo, and **Keep my content** preserve the authored phone settings.
**Use this design's sample content** may replace them as part of the reviewed
candidate. Swapping away from a phone field removes its phone-only parameters.
Update draft readiness, snapshot normalization, pack validation/capabilities,
and payload-size fixtures alongside the schema.

WConvert is pre-release: update bundled definitions and development fixtures
directly. No legacy reader, schema migration, or silent rewrite of saved Leads.
Development campaigns needing the new config should be reviewed and republished.

## Runtime and asset architecture

### Conditional asset delivery

Build one local Free-plugin asset containing the vanilla library, WConvert's
phone adapter, and its scoped CSS. Prefer embedding the small stylesheet in that
asset so each closed shadow root receives it and no unstyled-widget race is added.
Minify and measure the final emitted artifact, including all embedded data/styles.

Detect phone fields in the **page-matching payload after degradation**, walking
every journey screen, including optional later SMS steps. Enqueue the asset once
if any surviving campaign needs it. Do not enqueue it for unrelated phone
campaigns elsewhere on the site, email-only pages, or click-only pages.

This is page matching, not a guarantee that a popup will appear: a later trigger,
frequency limit, or visitor decision may prevent display. That is the accepted
tradeoff for downloading before interaction. Several phone campaigns share one
download and module, but keep separate widget instances and state.

Free continues to supply the asset when Pro replaces the main loader. Do not
make the phone asset depend on the Free loader handle, which Pro deregisters.
Maintain exactly one campaign loader and one optional phone feature asset.

Use normal versioned WordPress asset URLs, no runtime CDN requests. Protect
against duplicate initialization, missing files, stale caches, delayed scripts,
and optimizer reordering. Do not turn the phone asset into a prerequisite that
prevents an email-only campaign on the same page from working.

### Preserve the shared renderer boundary

Keep the base renderer dependency-free. It renders the accessible plain input
and exposes a small field-enhancement lifecycle seam; it must not import the
phone package or its country data into every loader.

Use the same vanilla adapter for visitor forms and editor previews. The admin
may import it through its own build; it should not introduce a separate React
phone implementation with different behavior. Gallery previews must clean up
instances as cards leave the viewport and must not load a second stylesheet per
render into the document head.

The first implementation slice must prove the following shared field contract:

- Read submission value separately from the input's formatted display.
- Snapshot and restore unsaved editing state, including selected country and
  incomplete text, not just the canonical number.
- Validate the visible input and focus it on a field refusal.
- Lock both number editing and country changes while submitting or reviewing
  accepted data.
- Close open pickers on campaign dismissal and destroy instances on screen
  replacement or preview teardown.

Give `Mounted`/journey handling access to these operations through an injected
service or per-mount field registry. Keep ordinary input behavior as the default.
Avoid an implementation that disguises formatted national input as canonical
data by temporarily rewriting `.value` during submission.

### Initialization and failure policy

Use a readiness handshake that works whether the phone asset or main loader runs
first. Enhancement failure must be contained to the affected field/mount.

Until enhancement is available, show the existing plain telephone input with
clear guidance to include `+` and the country code. It must not display a separate
country prefix that only exists visually but will not be submitted.

Only upgrade an untouched, unfocused plain input automatically. Once a visitor
has focused or edited a fallback field, preserve that input for the current
screen; do not reinterpret partially typed digits after a delayed download.
On a later remount, restore the recorded fallback/enhanced state deliberately.
Resetting a form creates a fresh opportunity to enhance.

If enhancement throws halfway through mount, restore the base input, label,
required state, value, and focus safely; remove partial UI and listeners. A
missing feature asset is an admin diagnostic, not a broken form for visitors.

No-JavaScript campaign rendering is outside this feature: the fallback described
here applies when WConvert itself runs but its phone enhancement fails.

## Number capture and validation

The visitor's country selection is parsing context, not a claim about residence,
consent, mobile capability, or subscription status. Store and route the existing
canonical `phone` value. Keep display text and country selection as temporary
page state; do not add a country column, raw-phone log, browser storage, or analytics
property containing the phone.

The adapter must call validation before using `getValue()`. Version 0.6.0 can
intentionally return a preserved invalid value. Handle `too_short`, `too_long`,
`invalid_length`, and `invalid_country` with localized visitor messages, and
apply WConvert's E.164 length/shape requirement as well.

For v1, keep server-side `Identifier::phone()` as the canonical acceptance gate:
normalize formatting and `00`, require explicit international form, and enforce
the existing digit envelope. Never rely on a submitted `valid` flag or append a
country code to a bare number on the server. Library country/length checks are
an additional browser plausibility aid, not a server-enforced promise of a real
or reachable phone number. Document and test this distinction explicitly.

All countries means all countries supported by the pinned dataset; it is not a
promise to support extensions, short codes, or every non-geographic service code.
The provider can still refuse delivery or require its own verification.

If strict country restrictions are added later, decide the server validation
contract first. Prefix matching alone cannot reliably distinguish countries that
share a dialing code (for example US and Canada). Do not expose `allowedCountries`
as a security or provider-eligibility rule before that work is complete.

### Journey behavior

- **Next:** validate visible unsaved required phone fields before advancing;
  optional empty fields are valid. An optional nonempty invalid field needs
  correction or clearing. Next does not save a Lead.
- **Back:** preserve incomplete text and selected country without claiming that
  the incomplete value is valid. Returning restores both accurately.
- **Submit:** snapshot canonical values only for the declared submission; freeze
  the phone and country while the request is pending. On failure, restore editing
  and focus the actual visible field, including a phone on an earlier screen.
- **Accepted submission:** retain the accepted canonical value; revisiting cannot
  alter either number or country or accidentally create a second submission.
- **Skip optional SMS:** do not validate or send its partial phone value. Clear
  that optional submission's unsaved phone/country/consent state. Keep the prior
  accepted email, Lead, and Conversion.
- **Close/reopen:** follow existing campaign recovery semantics; close the picker
  and preserve only what the current journey contract already preserves. Do not
  introduce persistent phone data through this integration.

Audit the actual production path through `bindJourney()`; changing only the older
`.wc-input` serialization helper in `capture.ts` would miss current submissions.
Keep `data-capture-id`, input labels, error targeting, and pending/read-only
behavior attached to the actual interactive control. Avoid duplicate named hidden
fields being mistaken for the input that must receive focus or validation.

## Styling, accessibility, and localization

- Insert phone styles inside each existing closed shadow root; map field font,
  border, padding, height, focus, radius, error, and disabled states to existing
  WConvert tokens. Preserve input-row layouts and narrow 320px designs.
- Keep dropdowns inside the campaign's shadow root/top-layer surface. The default
  library portal to `document.body` is unsuitable for a modal's focus/inert rules.
  Test clipping, transformed/animated surfaces, full-screen mobile dropdowns,
  scrolling, and multiple independent campaigns.
- In a popup, Escape closes the country picker first; another Escape may close
  the campaign. Search Enter selects a country, never submits the campaign.
- Keep phone digits left-to-right in RTL layouts; surrounding labels/help follow
  the site direction. Use country names and codes when emoji flags are missing.
- Retain labels, autocomplete, the telephone keyboard, required indicators,
  described-by errors, and focus return. Test desktop keyboard and touch use.
- Pass locale for country names and translate WConvert's labels/error messages.
  v0.6.0 still hardcodes several picker/search/close/live-region strings in
  English. The first integration slice must resolve these too. Prefer a small
  upstream configurable-strings API over permanent DOM mutation workarounds;
  do not claim full localization based on country-name translation alone. A
  release containing that addition may become the final exact package pin.

## Scenario and acceptance matrix

| Scenario | Required result |
| --- | --- |
| No campaign matches the page | No loader or phone feature download |
| Only email/click campaigns match | No phone feature download |
| Phone is on an optional later screen | One page-level phone download; mount only when that screen exists |
| Several phone campaigns match | One asset download; no shared visitor field state |
| Default country unset | Phone publication needs an override or site default; other campaigns unaffected |
| Field override differs from site | Override wins in preview and published capture |
| Site default changes | Live snapshot remains stable until republish; explicit overrides remain unchanged |
| Local number with selected country | Correct canonical international value; no duplicate calling code |
| Paste/autofill includes `+` or `00` | Detect explicit calling code and preserve digits |
| Persian/Arabic numerals | Normalize without cursor jumps or digit loss |
| Shared calling code | Preserve explicit selection on Back/Next; do not claim accurate country identification from code alone |
| Leading national zero / significant zero | Cover GB and Italy, plus representative target markets; no blanket zero stripping |
| Overlong/short/unknown input | Preserve editable input, show a correction, never silently truncate |
| Extension-bearing or unsupported input | No silent folding of extension digits into an accepted number; establish safe behavior before shipping |
| Empty optional phone | No error and no phone value submitted |
| Invalid phone on optional SMS screen, then Skip | Skip succeeds; prior email stays accepted |
| Previous-screen phone fails server validation | Return to the right screen, retain values, focus visible phone input |
| Request pending or already accepted | Country and number cannot change |
| Campaign closes with picker open | Picker closes; no detached portal or leaked listeners |
| Phone asset fails or arrives after editing starts | Usable plain international field; typed data/focus preserved |
| Free + each paid tier | One main loader, one phone asset where needed, identical phone behavior |
| Editor typing, undo, template swap, gallery scrolling | Correct preview and settings; no accumulating instances/listeners |
| WSMS absent / local-only capture | Same field and validation; capture remains functional |
| WSMS/other Destination rejects delivery | Accepted capture remains a Lead; existing delivery diagnostics apply |
| Cached page after republish | Existing contract-mismatch handling; no acceptance using a different default silently |

Use a number corpus covering US/Canada, GB, Oman, UAE, Iran, India, Italy, Germany,
and Australia, with local/international examples, spaces, parentheses, replacements,
and cursor edits. These are test markets, not a restriction on supported countries.
Newly discovered data-corruption cases are release blockers and should be fixed
upstream where they originate; tests passing for the original two issues is not
a reason to waive them.

## Performance budget

Current built artifacts, gzip level 9:

| Asset | Current | Existing cap | Headroom |
| --- | ---: | ---: | ---: |
| Free loader | 13,104 B | 14,012 B | 908 B |
| Basic loader | 19,242 B | 20,480 B | 1,238 B |
| Pro loader | 20,237 B | 20,480 B | 243 B |
| Elite loader | 20,425 B | 20,480 B | 55 B |

Do not promise zero growth in the base loader: lifecycle and field-value plumbing
will cost bytes even though country data and the widget stay in a separate file.

Propose a **16 KiB gzip cap for the complete optional phone asset**, including its
adapter, styles, and country data. Count any per-page strings or configuration
under the payload budget too. This is a target for the first slice to validate,
not permission to silently increase an existing cap.

Keep the current base caps as the first target. If the integration needs an
increase, report actual before/after results for all four tiers and propose the
smallest justified amendment. Do not move unrelated code into the optional asset
to make the main-loader figures appear smaller.

Extend the budget check to include both individual artifacts and combined
phone-enabled page cost. Rough planning: current Free loader + current library
is about 26 KB compressed, before WConvert adapter overhead. Email/click pages
pay only the small shared integration overhead, not the additional ~13 KB library.

The current architecture emphasizes a single loader and fully measured feature
costs. A separate conditional asset is a deliberate proposed amendment to that
asset contract, not an unmeasured exemption. Keep one campaign loader, measure
the added feature, and update affected ADR text in the implementation decision.

## Delivery sequence

1. **Prove the integration seam and cost.** Pin the package in an isolated
   implementation branch. Build a vertical slice through the real shared mount,
   closed-root modal, conditional asset handshake, and canonical submission.
   Exercise missing/delayed assets and localization feasibility. Measure all
   emitted bundles and confirm the final loading/budget contract before widening
   the implementation. This slice is not a production release.
2. **Settings and published contract.** Add the site setting, per-field params,
   manifest/type/PHP normalization, readiness, publish-time country resolution,
   template/snapshot/pack support, and admin country choices sourced from the
   same pinned dataset. No database schema change.
3. **Complete runtime and capture lifecycle.** Integrate every display surface,
   journey snapshots, validation/error focus, pending/accepted locks, skip,
   close/reopen, failure fallback, and Pro loader replacement. Add scoped style
   and localized copy handling.
4. **Editor and authoring polish.** Add field controls and inheritance guidance;
   update examples/playbooks where their international-only copy is misleading.
   Verify gallery, builder preview, template switching, undo, and narrow layouts.
5. **Verification and release preparation.** Run focused PHP/JS tests, typecheck,
   lint, template/source/artifact checks, all loader budgets, and the browser
   scenario matrix. Verify activation, assets, actual submitted Lead values, and
   Pro replacement in real WordPress/Playground. Finish mobile/autofill and
   keyboard/screen-reader checks. Open a reviewable PR with measured totals.

The implementation decision should update `CONTEXT.md` and amend relevant text
in ADRs 0004, 0009/0011, 0010, 0014, 0021, 0029, and 0103 as applicable, preserving
their later amendments (including the paid-budget update in 0104). This plan
proposes changes; it does not mark those architectural decisions as accepted.

## Main code touchpoints

| Area | Existing code / proposed addition |
| --- | --- |
| Site setting | Existing Settings REST/service patterns; `resources/admin/src/settings-page/Settings.tsx`; new focused phone-default service |
| Field schema | `resources/templates/manifest.json`, `resources/renderer/src/types.ts`, `src/Template/TemplateVocabulary.php` |
| Publication | Campaign publication flow, `src/Optin/PublishedProjection.php`, `src/Template/CaptureContract.php` |
| Asset eligibility | `src/Frontend/LoaderEnqueue.php`, payload/tag metadata, `pro/src/Frontend/ProLoaderEnqueue.php` |
| Phone implementation | Proposed `resources/phone/src/` and separate local visitor build output |
| Mounting and visuals | `resources/renderer/src/render.ts`, `mount.ts`, shared field lifecycle seam |
| Journey/capture | `resources/loader/src/journey.ts`, `capture.ts`, `present.ts`; `src/Lead/CaptureForm.php` / `Identifier.php` acceptance tests |
| Inspector and previews | `resources/admin/src/builder/SlotFields.tsx`, panel/structure/readiness helpers, `Preview.tsx` |
| Build/release checks | `package.json`, exact lockfile pin, Vite build, `bin/check-loader.mjs`, artifact packaging and license notices |

## Done means

- The four confirmed product choices are implemented, including stable live
  defaults until republish.
- Native input/fallback behavior and enhanced behavior both submit the intended
  canonical value; no known silent phone-number rewriting remains.
- All supported Free/paid display surfaces and journey scenarios pass on real
  WordPress, with browser and mobile evidence recorded.
- Page eligibility controls the optional download, every extra byte is counted,
  and any necessary budget/architecture amendment is explicit.
- Localized labels, accessible picker behavior, preview parity, and listener
  cleanup are verified rather than inferred from upstream claims.
- No new consent/Contact lifecycle, outbound phone lookup, or personal-data
  persistence is introduced.
