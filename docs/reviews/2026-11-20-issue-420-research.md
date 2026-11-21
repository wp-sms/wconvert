# #420: what to match, what to add, what the rules allow

Date: 2026-11-20. Issue: [#420](https://github.com/wp-sms/wconvert/issues/420).
Research only: no plugin code changes.

Three parts:

1. The nine things WSMS and WP Statistics shipped, set against what WConvert
   already does.
2. The wordpress.org rules that decide the clashes.
3. A ranked list of ideas from twelve plugins.

## How this was researched

- **Plugins.** Each plugin's current stable ZIP from `downloads.wordpress.org`
  was read and grepped, never run. Then its readme, then the vendor's own
  pricing pages.
- **Versions read:**

  | Plugin | Version |
  |---|---|
  | OptinMonster | 2.17.1 |
  | WPForms Lite | 2.0.5.1 |
  | MonsterInsights Lite | 11.3.0 |
  | Complianz | 7.5.7 |
  | Yoast SEO | 28.9 |
  | Rank Math | 1.0.282 |
  | Jetpack | 16.4 |
  | Elementor | 4.4.1 |
  | WooCommerce | 11.3.0 |
  | Wordfence | 9.1.1 |
  | Akismet | 5.7.2 |
  | CookieYes | 3.5.9 |

  Citations read `slug@version: path`.
- **Rules.** Read from the pages that own them on 2026-11-20 and quoted
  verbatim.
- **Depth.** The four closest plugins (OptinMonster, WPForms, MonsterInsights,
  Complianz) got a deep pass. The other eight got a focused one. Pricing pages
  were checked for the closest four only.
- **Checks.** Five claims were checked by hand against their sources:
  - OptinMonster's review gate (`50 < allConversions || 30 < allLeadsAllTime`, in the shipped source map).
  - Elementor's "more than 10 pages, Dashboard only" review gate (`core/admin/admin-notices.php:302-318`).
  - WPForms' feed being drawn only above the All Forms table (`src/Admin/Notifications/Notifications.php:71-73`).
  - The review checklist's "not permitted" item.
  - The core proposal's text.
- **ADRs.** Every ADR cited below was read with its inline amendment notes.

## 1. Mostafa's nine items against WConvert today

| # | Item | WConvert today | Status |
|---|---|---|---|
| 1 | Promo notices fetched from Horizon | The bell shows local problems only. No promotional content is fetched. The only remote content in the admin is the design library and, when an admin turns them on, Google Fonts in the editor preview (readme, External services). | **Clash.** The bell belongs to notifications ([0143](../adr/0143-license-page-and-updater.md) §7). Help "fetches nothing" ([0144](../adr/0144-help-is-a-page.md) §4). Pro hints are "bundled copy, no remote call" ([0147](../adr/0147-free-names-what-pro-adds-where-it-is-wanted.md) rule 5; 0189 changed only the UTM key). Rules: §2a. |
| 2 | Header sale banner from Horizon | The header's "Explore Pro", or "Activate it" when Pro is installed but inactive. Bundled, fixed UTMs. | **Clash.** Free's whole upsell is the header link, the Settings list and the contextual hints ([0116](../adr/0116-free-shows-nothing-it-cannot-run.md) §2 as amended by 0147). All are bundled (0147 rule 5). |
| 3 | Licence lifecycle | Built in `pro/src/License/`: <ul><li>a daily Nexus refresh</li><li>16 states, including `expiring`, `expired`, `trial`, `trial_ended`, `payment_failed`, `moved` and `over_limit`</li><li>an amber dot on the header plan badge and a line on the Plugins screen, which start:<ul><li>14 days before the end for a manual or cancelled renewal (`LicenseState.php:265`, `RENEWAL_WINDOW_DAYS`)</li><li>7 days before the end for a trial (`LicenseNotice.php:111`)</li><li>never for an auto-renewing licence, which reads as `active`</li></ul></li><li>a red dot once updates stop</li><li>Renew and Buy actions</li><li>status, Sites and License key cards</li></ul> | **Mostly done.** Differences: <ul><li>The reminder sits on the badge, not the bell ("The bell is never part of it", `LicenseNotice.php`).</li><li>The windows are fixed in code (14 days, and 7 for trials), not taken from Nexus's reminder days.</li><li>There is no "Add another key". Pro is one tier and one key per site ([0146](../adr/0146-pro-is-one-tier.md)).</li></ul> |
| 4 | Add-ons page states | None | **Clash.** There is one Pro, in one ZIP, with no add-ons to list ([0146](../adr/0146-pro-is-one-tier.md) §5). |
| 5 | Pricing table, money-back strip, compare in onboarding | A static "More with Pro" list in Settings and one-line contextual hints | **Clash.** Hints are "never in the dashboard … admin notices …" ([0147](../adr/0147-free-names-what-pro-adds-where-it-is-wanted.md) rule 4). The Pro hint is "never on an empty state, a success screen or a dashboard" (design-system GUIDELINES §8, as amended by 0147). First-run is the checklist card ([0176](../adr/0176-a-new-site-is-guided-to-its-first-lead.md)). |
| 6 | wordpress.org review request | The review card ([0191](../adr/0191-the-admin-asks-for-a-review-once.md), PR #426): <ul><li>shows after the first conversion</li><li>asks at most twice, with "Maybe later" bringing it back after 30 days</li><li>an answer ends it</li><li>links `…/reviews/#new-post` with no 5-star filter</li></ul> | **Done** |
| 7 | Zero-annoyance rules | <ul><li>Other plugins' notices are hidden on WConvert's screens only ([0035](../adr/0035-the-admin-owns-its-page.md), Consequences).</li><li>No usage telemetry. The plugin sends nothing about campaigns, leads or visitors. What does reach outside services is in the readme's External services:<ul><li>The design library sees the server's IP address, and counts downloads per design.</li><li>Pro adds its licence key and domain when a Pro design is added.</li><li>Bot verification and Google Fonts are both off by default.</li></ul></li><li>One licence reason, shown on the badge.</li><li>No menu bubble.</li></ul> | **Done**, except "soft focus rings", which nothing specifies |
| 8 | Modal rules | No upsell modal (0147 rule 3). Show-once flags per feature, e.g. the checklist's hidden flag (0176) and the review card's answer (0191). | **Done.** There is no shared registry, and with two asks none is needed yet. |
| 9 | Sales only through the remote service | No sale text or dates in code. The only discount anywhere is Nexus's renewal coupon on the License page. | **Done in spirit.** No remote service reaches Free. |

## 2. What the wordpress.org rules say

Sources:

- **[G]** [Detailed Plugin Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/), last updated 2026-03-11.
- **[CI]** [Common issues](https://developer.wordpress.org/plugins/wordpress-org/common-issues/).
- **[RC]** [Review Checklist](https://make.wordpress.org/plugins/handbook/performing-reviews/review-checklist/), last updated 2026-10-14.
- **[INST]** [Guidance on plugins that install other plugins](https://make.wordpress.org/plugins/2024/09/09/guidance-on-plugins-that-install-other-plugins/), 2024.
- **[PC]** [Plugin Check](https://github.com/WordPress/plugin-check) 2.2.0.
- **[PROP]** [WordPress notifications and declared intent](https://make.wordpress.org/core/2026/11/16/wordpress-notifications-and-declared-intent-proposal-for-the-path-forward/), a Make/Core proposal of 2026-11-16, feedback until 2026-11-30.

`how-your-readme-txt-works` has no external-services section. The disclosure
rule lives in [G] 6 and 7, [CI] and [RC].

### The quotes that decide it

- **[G] 5, trialware:** "Plugins may not contain functionality that is restricted or locked, only to be made available by payment or upgrade." Also: "Attempting to upsell the user on ad-hoc products and features is acceptable, provided it falls within bounds of guideline 11."
- **[G] 6, SaaS:** "The service itself must provide functionality of substance and be clearly documented in the readme file". Also: "A plugin that acts only as a front-end for products to be purchased from external systems will not be accepted."
- **[G] 7, tracking:** "plugins may not contact external servers without explicit and authorized consent. This is commonly done via an 'opt in' method, requiring registration with a service or a checkbox within the plugin settings."
- **[G] 8, executable code:** its examples include "Serving updates or otherwise installing plugins, themes, or add-ons from servers other than WordPress.org's" and "Installing premium versions of the same plugin".
- **[G] 9, dishonest:** "Compensating, misleading, pressuring, extorting, or blackmailing others for reviews or support". Also: "Implying users must pay to unlock included features".
- **[G] 11, admin:**
  - "Upgrade prompts, notices, alerts, and the like must be limited in scope and used sparingly, be that contextually or only on the plugin's setting page. Site wide notices or embedded dashboard widgets must be dismissible or self-dismiss when resolved."
  - "Advertising within the WordPress dashboard should be avoided".
- **[RC] Not Permitted,** "not permitted in any new plugin": "Remote loading data when not absolutely necessary." and "Tracking usage without explicit opt-in consent."
- **[RC] Security and Privacy:** "Collection of user data must be “opt-in” only and have the relevant option set to disabled by default."
- **[RC] Selling, credits and links:** "Upselling is permitted from plugin settings screen or a link on their entry on the plugin list page." Also: "UTM links to a developer's site are allowed anywhere links are permitted."
- **[CI], undocumented third parties:** disclosure is required "even if you are the 3rd party service". The readme must say when the service is used, and link the service and its terms or privacy policy.
- **[PC] errors:**
  - `five_star_reviews_detected`: "Linking directly to 5 stars reviews is not allowed."
  - `external_admin_menu_link`.
  - Plugin Check has no rule yet for notices, dismissal, upsells or review prompts.
- **Admin notices API:** the `is-dismissible` class "applies only on the current screen" ([`admin_notices`](https://developer.wordpress.org/reference/hooks/admin_notices/)). A dismissal that lasts needs stored state.

### 2a. Verdicts on Mostafa's items

| Item | Verdict | Why |
|---|---|---|
| Remote promo feed and banner, **on by default** | **Not allowed** | A promo feed is not a service with "functionality of substance" ([G] 6), so the [G] 7 consent rule applies. [RC] also lists "Remote loading data when not absolutely necessary" as not permitted. |
| Remote promo feed, **opt-in, off by default** | **Unclear** | [G] 7 allows contact with consent, but [RC]'s ban has no opt-in exception. Ask plugins@wordpress.org before building it. If allowed, all of these apply:<ul><li>an off-by-default checkbox</li><li>a readme External services entry</li><li>text-only data, never HTML or JS ([G] 8)</li><li>bundled images ([CI])</li><li>our own screens only, with a dismissal that persists per user</li><li>UTMs but no referral IDs</li><li>no site identifiers sent</li><li>real deadlines only ([G] 9)</li></ul> |
| Promo or feed **in Pro only** | **Allowed** | Pro is not hosted or reviewed on wordpress.org. It holds only if Free contains nothing that triggers or renders the feed. [G] 2 forbids "Intentionally writing code to circumvent guidelines". |
| Pricing table and money-back strip in onboarding | **Allowed with conditions** | It must sit on our own screens, be skippable, bundled and true. It must never show free features as locked ([G] 5, [G] 9). Whether onboarding counts as the "settings screen" is unclear. |
| Add-ons page | **Allowed with conditions** | Links only. Never install Pro from our server, even in one click ([G] 8, [INST]). Not a storefront ([G] 6). |
| Review request | **Allowed with conditions** | No incentive, pressure or `?filter=5` link. Dismissible and sparing. Re-asking after "Maybe later" is not addressed. WConvert's single 30-day re-ask is defensible. |
| Licence notices | **Allowed** | They live in Pro. |
| Usage events sent to us | **Opt-in only** | Off by default, disclosed, with a privacy link. Third-party analytics are not allowed ([RC]). Counts kept in the site's own database are not covered by any rule and are probably fine. |

### 2b. A rule change is under discussion

[PROP] would require every admin notice to declare an intent. Its
`promotional` intent covers "Upsells, discounts, tips, 'What's new', review
requests, surveys", "info only", and is "Hidden on core screens, always
dismissible". The core screens it names are "the Dashboard, Plugins, Posts and
Settings". Its examples:

- "Your license expires in 30 days, renew now": promotional.
- "Your license expired, updates have stopped": operational.

**What it means for WConvert:**

- The review card and the Pro hints already sit inside our own page.
- Pro's **pre-expiry** line on the Plugins screen is the one message the
  proposal's examples call promotional. The proposed runtime would not hide it
  automatically: `PluginsScreen::row()` prints it under the plugin row, not
  through a notice channel. A reworded Guideline 11 could still apply to it.
  The badge dot is unaffected.

Feedback closes 2026-11-30.

### 2c. The design library, for completeness

[ADR 0175](../adr/0175-the-online-library-loads-without-asking.md) turned the
library on by default under [G] 6/7's service exemption. The library supplies
designs, which is functionality, so the exemption fits it. A promo feed cannot
claim the same exemption. Nothing here reopens 0175, but the [RC] "remote
loading" line is the one a reviewer would raise against it.

## 3. What the twelve do

The closest four, side by side:

| | OptinMonster | WPForms Lite | MonsterInsights Lite | Complianz |
|---|---|---|---|---|
| Free model | SaaS; 500 impressions, then the account "will be upgraded" (`readme.txt:46-47`) | Entries not stored; 3% payment fee | Reports for the last 30 days | Fully working; scan covers 50 posts |
| When the review ask appears | **>50 conversions or >30 leads**, own pages (`ReviewBar.vue:105`) | 14 days and 1 published form, site-wide (`class-review.php:172-209`) | 14 days after GA connects, site-wide (`review.php:83-91`) | 1 month, site-wide (`class-review.php:27-41`) |
| What "Maybe later" does | Asks again after 30 days | Never asks again | Never asks again | Asks again monthly |
| Unhappy path | "Not really" goes to a feedback form, not wp.org | none | built but never shown | none |
| Remote feed | `a.omwpapi.com`, twice a day, menu badge that "jiggles" on every page | `wpformsapi.com`, daily, **All Forms page only** | `plugin-cdn.monsterinsights.com`, daily, own header, at most 5 | `notifications.complianz.io`, daily, can go site-wide |
| Feed off switch | "Hide Announcements" | "Hide Announcements", which also stops the review ask | the same | "Disable notifications" |
| Feed in the readme | no | no | no | no |
| Usage tracking | turns itself on when an API key is saved (`ApiKey.php:52`) | turned on by Lite Connect; a migration overrode a stored "no" | always on in Pro | cookie-database sync is opt-out |
| Money-back | 14 days | 14 days | 14 days | 30 days |
| Standing discount | "save 50%", plus a "BFCM 60% OFF!" submenu from 23 Nov 2026 | "50% off" | `LITEUPGRADE` 50% | 40% code, though its pricing page says "no discounts" |

### Patterns worth copying

- **The upsell quotes the user's own numbers.**
  - WPForms counts entries it does not store: "N entries have been backed up since…".
  - MonsterInsights opens with "Congrats! You've hit 500 monthly sessions!" before pitching.
  - Complianz says "Your free plan covers only 50 posts".
- **Asks are gated on use, not the calendar.**
  - Elementor asks for a review only after more than 10 pages (`elementor@4.4.1: core/admin/admin-notices.php:306`).
  - Its Go Pro banner and tracking ask wait for 2 pages.
  - OptinMonster waits for 50 conversions or 30 leads.
- **Milestones are a delight of their own.** WooCommerce notes the 1st, 10th, 100th … 1,000,000th order, skipping ones passed before activation (`OrderMilestones.php:56-196`). It also notes "Woohoo, … was your record day for sales!" (`NewSalesRecord.php:132`).
- **Proof of value sits where people already look.**
  - Akismet shows "protected your site from N spam comments" in At a Glance.
  - Wordfence's weekly email is on by default and carries one upsell line for free users (`activity-report-email-inline.php:134`).
- **Sample instead of blur.** MonsterInsights offers "See a Sample Report" beside every locked report (`C/ReportPageLayout-*.js:505-588`).
- **Deactivation guard.** Elementor's deactivation reasons include "I have Elementor Pro", which warns that both must stay active (`core/feedback.php:104-107`).
- **Cool-downs between asks.**
  - Yoast shows no upsell within 14 days of an install or update, and none within 7 days of the last one (`delayed-premium-upsell.php`).
  - Elementor prints one notice per page load (`admin-notices.php:776-797`).
- **Promotions stay on the plugin's own pages.** Yoast's Black Friday promotion now shows only on Yoast pages (`black-friday-announcement.php`). That followed the
  [2019 banner](https://wordpress.org/support/topic/i-did-not-consent-to-animated-banner-ads-all-over-the-wp-admin-area/)
  that was [pulled in 12.6.2](https://developer.yoast.com/changelog/yoast-seo/page/11/).
- **Remote feeds that send nothing.** WooCommerce sends only `?locale=` and decides locally what to show (`RemoteInboxNotificationsDataSourcePoller.php`). Elementor evaluates targeting locally. Both have an off switch.

### Cautionary tales

- **Elementor Pro's renewal notice.** It could not be closed, sat on every admin page of client sites, and Elementor declined to change it ([elementor#13102](https://github.com/elementor/elementor/issues/13102)).
- **WooCommerce's WooPayments menu item.** A red bubble for software the store had not installed ([woocommerce#39668](https://github.com/woocommerce/woocommerce/issues/39668)).
- **WooCommerce 3.6's "dashboard ads"** ([woocommerce#23198](https://github.com/woocommerce/woocommerce/issues/23198)).
- **Rank Math's review loop.** × reschedules the ask every 14 days, it links `?filter=5`, and half of all asks go to Trustpilot (`seo-by-rank-math@1.0.282: includes/admin/class-ask-review.php`).
- **Sister-plugin installs counted as "setup progress"** (WPForms, MonsterInsights, Complianz), and fake-feature submenus (OptinMonster's "Landing Pages" is SeedProd).
- **A standing "50% off" that becomes the list price,** followed by "renewals at full price" (all three Awesome Motive plugins).
- **Consent that switches itself on** (all four closest).

## 4. Ranked ideas

Key:

- **Effort:** S = days, M = a week or two, L = more.
- **Impact:** on installs, conversion or happiness.
- **Risk:** wordpress.org rule risk.

### Do next

| # | Idea | Where in WConvert | Source | Effort | Impact | Risk | ADR it changes |
|---|---|---|---|---|---|---|---|
| 1 | **The Destinations hint quotes the merchant's own number:** "128 leads so far. Also in WConvert Pro: Mailchimp, Brevo and webhooks." | Destinations provider hint (`ProHint`) | WPForms, MonsterInsights, Complianz | S | High | Low | [0147](../adr/0147-free-names-what-pro-adds-where-it-is-wanted.md) rule 6 (names from data; now a count too) |
| 2 | **Lead milestones:** first lead, 10, 100, 1,000, and best day. One line in the Analytics overview and the weekly email. Skip milestones passed before the plugin was installed. | Analytics overview, weekly summary | WooCommerce, Akismet | M | Medium (delight, and a natural lead-in to the review card) | Low | GUIDELINES §8 (a line that does not change what you do next) |
| 3 | **One Pro line in the weekly email**, free installs only, bundled, honouring `wconvert_show_pro_hints`. | `src/Report/SummaryTemplate.php` | Wordfence | S | Medium | Low (email, not admin) | [0147](../adr/0147-free-names-what-pro-adds-where-it-is-wanted.md) rule 4, [0176](../adr/0176-a-new-site-is-guided-to-its-first-lead.md) §4 |
| 4 | **Warn before deactivating Free while Pro is active.** Today Pro explains only afterwards (`pro/src/Boot/BootGuard.php`). | Pro's `PluginsScreen.php` | Elementor | S | Medium (support load) | Low (Pro only) | none |
| 5 | **Renewal window from Nexus's reminder days**, if Nexus sends them, instead of the fixed 14 (manual or cancelled renewals) and 7 (trials). | `LicenseState::RENEWAL_WINDOW_DAYS` | Mostafa #3 | S | Low | none | [0143](../adr/0143-license-page-and-updater.md) §8 |

### Worth doing

| # | Idea | Where | Source | Effort | Impact | Risk | ADR |
|---|---|---|---|---|---|---|---|
| 6 | **Read the UTMs we already send.** Every Pro link carries a fixed `utm_content` per surface ([0189](../adr/0189-links-to-our-sites-carry-one-scheme.md)). Join them to Nexus checkouts on wconvert.io's side. That answers "which placement sells" with no telemetry in the plugin. | wconvert.io / Nexus, not the plugin | all four closest | S | High (for deciding) | none | none |
| 7 | **A labelled sample report before the first lead.** It previews free Analytics; it is not a lock. | Analytics empty state | MonsterInsights | M | Medium | Low | [0185](../adr/0185-analytics-reads-at-a-glance.md) |
| 8 | **"Something wrong? Tell us"** support link on the review card, *beside* Rate, never instead of it. | `ReviewCard.tsx` | OptinMonster | S | Medium (catches unhappy users) | Low as a link beside Rate; replacing Rate would be review gating | [0191](../adr/0191-the-admin-asks-for-a-review-once.md) |
| 9 | **Respond to the declared-intent proposal by 30 Nov,** and tag our messages by its intents. Only Pro's pre-expiry Plugins-screen line would move. | Pro `LicenseNotice` | [PROP] | S | Medium (future-proofing) | n/a | [0143](../adr/0143-license-page-and-updater.md) §11 if adopted |

### Needs your call (the clashes)

| # | Mostafa's item | What WConvert does instead, and why | Options | Risk |
|---|---|---|---|---|
| 10 | Horizon promo notices (#1) | No promotional content reaches Free's admin, and the bell is only for problems. A promo feed is not a service, so it cannot use 0175's exemption. | **a.** Keep Free bundled; put a Horizon feed in **Pro only** (renewals, announcements). **b.** An opt-in Free feed under the conditions in §2a, after asking plugins@wordpress.org. **c.** No feed. | a: low. b: medium. On by default: high. |
| 11 | Header sale banner (#2) | The header link is bundled, with fixed UTMs. | **a.** Pro-only, from Horizon. **b.** Free gets a dated sale bundled into a release, as Yoast does, but that breaks your #9 "no sale text in code". **c.** None. | a: low. b: low rule risk, conflicts with #9. |
| 12 | Pricing table and money-back in onboarding (#5) | First-run is a three-step checklist to the first lead. A table there is the "marketing line on a success screen" GUIDELINES §8 deletes. | **a.** Keep it out. **b.** A bundled Free-vs-Pro table behind the existing "More with Pro" list in Settings, which [RC] explicitly allows on settings screens. **c.** Onboarding, skippable. | a, b: low. c: low rule risk, but breaks our own rules. |
| 13 | Event measurement (R&D) | No usage telemetry. Design-library download counts are the only usage signal that reaches us. Local first-edit evidence exists (`src/Milestone/`). | **a.** UTMs, Nexus and wp.org stats only (idea 6). **b.** Opt-in telemetry, off by default, disclosed in the readme. | a: none. b: medium. |

### Skip, and why

| Idea | Why not |
|---|---|
| Add-ons page (#4) | One Pro, no add-ons ([0146](../adr/0146-pro-is-one-tier.md)). |
| "Add another key", several keys | One tier, one key per site. |
| Paste a key into Free and Pro installs itself (MonsterInsights) | [G] 8: "Installing premium versions of the same plugin". |
| Standing "50% off" everywhere | It becomes the list price, and renewals at full price then read as a bait. |
| Menu badges counting promos (OptinMonster, Complianz) | A badge means something needs fixing. See WooCommerce #39668. |
| Gating first use behind an email or account (Complianz, Wordfence) | WConvert's promise is "no account to create" (readme FAQ). |
| Remote docs index for in-app search (WPForms) | Already rejected in [0144](../adr/0144-help-is-a-page.md) §3: an external request needing disclosure, for less than the site's own search. |
| A global notice registry with cool-downs (Yoast, Elementor) | There are two asks, the Pro hint and the review card. Revisit if a third appears. |
| Sister-plugin installs in setup | There are none to install, and it pads progress. |

## Not covered

- Pricing pages for the eight lighter plugins.
- Formal wordpress.org actions against any of the twelve. None were found.
- Whether [PROP] will be adopted.
- How wp.org search ranking drives installs.

## Decisions (2026-11-21)

**Made into issues:**

| Idea | Issue |
|---|---|
| 10, Horizon promo notices (parked) | [#428](https://github.com/wp-sms/wconvert/issues/428) |
| 11, Header sale banner (parked) | [#429](https://github.com/wp-sms/wconvert/issues/429) |
| 1, the Destinations hint shows the site's own lead count | [#430](https://github.com/wp-sms/wconvert/issues/430) |
| 2, lead-count landmarks | [#431](https://github.com/wp-sms/wconvert/issues/431) |
| 3, one Pro line in the weekly email | [#432](https://github.com/wp-sms/wconvert/issues/432) |
| 4, warn before deactivating Free while Pro is active | [#433](https://github.com/wp-sms/wconvert/issues/433) |
| 5, renewal window from Nexus | [#434](https://github.com/wp-sms/wconvert/issues/434) |
| 8, support link beside Rate | [#435](https://github.com/wp-sms/wconvert/issues/435) |

**Skipped:**

- 6, reading the UTMs against Nexus checkouts
- 7, the sample report
- 9, commenting on the core proposal

**Left for Mostafa on #420:**

- 12, the pricing table in onboarding
- The add-ons page

**Note for #431.** [[Milestone]] is already a glossary term. Its entry says a reached Milestone "changes nothing a merchant does next". The feature needs its own word.
