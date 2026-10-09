# Harbor is the shared admin frame

## Decision

The user selected refined prototype G (Harbor), then explicitly authorized its
implementation. The accepted composition puts headline, description and CTA on
a light surface below compact dark navigation, retaining the dark service footer.
This supersedes the visual frame in ADR 0092 and conflicting palette, depth and
entry-motion choices in ADRs 0036/0037. Campaign workflows, data contracts,
semantic statuses and accessibility requirements remain in force.

## Shared system

Shell owns a deep-teal brand row (espresso since
[ADR 0130](0130-the-admin-wears-the-wconvert-io-brand.md)), separate four-section navigation, light heading
area, aligned work area and matching service footer. Display (44px, 36px on
phones), brand (26px, 22px on phones), item (15px) and result (22px) are reusable
type roles. Compact editor title and editing-furniture roles retain their sizes.
DM Sans is bundled locally with its OFL license, including in the Pro build.
App and portal headings explicitly inherit that stack: WordPress's RTL
localization stylesheet otherwise assigns Arial directly to heading elements,
overriding the shell's inherited font. The real-WordPress visual matrix guards
the same heading font in both directions without changing WordPress chrome.
Each font weight has a content-hashed URL; generic main.ttf names can swap weights
between builds while a browser still has the old file cached.

Primary is #205c57, frame #183c40, canvas #EAF0ED, and cards white.
_Amended by [ADR 0130](0130-the-admin-wears-the-wconvert-io-brand.md): primary
and frame are both espresso #302720, the canvas is paper #FAF6ED, cards stay
white, and citron #E2F475 marks the active tab, unread dot and focus on the
frame._ Shared shadows
are removed. All admin motion, including portaled layers, is disabled; actual
WordPress behavior outside the app is not changed. Reading-page heading buttons and selects
share a 48px floor; existing compact and coarse-pointer scopes remain. Campaigns
uses one white sheet, larger identity previews, ghost row actions and status
dot/text treatments without changing their meaning, ordering or behavior.

The detail pass establishes white goal and target cards against the mist canvas
(paper since [ADR 0130](0130-the-admin-wears-the-wconvert-io-brand.md)),
with shared inset, interaction and border colors instead of per-card green fills.
Reading section headings use 20px; dashboard totals use 36px, below the page title.
Supporting text stays at 13px. Header selects and secondary buttons share height,
alignment, white fill and control borders; actions wrap at narrow widths.

## Real destinations and integration

The footer repeats the shared WConvert mark (the wconvert.io SVG since
[ADR 0130](0130-the-admin-wears-the-wconvert-io-brand.md)) and wordmark with a compact plan
badge. It omits the site title/address and credits VeronaLabs with its official
logo, bundled locally, linked to https://veronalabs.com/. The same plan badge is
used in navigation. The publisher credit sits centered in a separate bottom row with a muted
monochrome logo. “A product by” is outside the link; logo hover never underlines
the credit, and keyboard focus remains visible.
The header has no redundant link to the site's front end. The
footer links to Visitor experience settings and reuses working header Help links.
Campaign guides and direct support need real destinations before those prototype
labels can ship. No sample version, account session or operational status is
invented. Existing account integration remains outside this change.

Creation omits the service footer. The editor keeps its own task-focused frame;
shared palette and typography still apply. WordPress keeps its menu and toolbar.
Its duplicate footer and bottom reservation are hidden only on WConvert screens. Logical layout, wrapping labels, small screens and visible
keyboard focus remain requirements. The exploration and selector are removed
once the chosen system is absorbed.

## Deferred

Richer result explanations, revised next-action logic, new empty/error-state
content and actual campaign guides remain separate design work. This decision
approves the visual foundation, not those additional workflow changes.

## Verification

Both Free and Pro admin builds pass. TypeScript, scoped ESLint, 379 focused JS
checks and 19 PHP settings/replacement checks pass. Browser review covers the
local WordPress Campaigns, Analytics, Leads and Settings frame, mobile overflow,
footer help/navigation, and static computed motion. The shared shell also passed
360px RTL and 900px gallery checks with sample fixtures before prototype removal.

The follow-up detail pass rechecks the four reading screens and the 360px
Analytics layout. The report select and export button both measure 48px, the
WordPress footer is hidden, and there is no horizontal overflow. Muted text
measures 5.24:1 on the canvas and 6.05:1 on white; control borders measure 3.30:1
on the canvas and 3.82:1 on white. _Corrected by
[ADR 0130](0130-the-admin-wears-the-wconvert-io-brand.md): those are Harbor's
values. Muted text now reads 5.67:1 on paper and 6.12:1 on white, control
borders 3.89:1 and 4.19:1._

Expanded destination settings use a white editing surface with an inset usage
notice and one shared-change warning. The notice retains saved/live usage and
Undo limitations; Save remains associated with it. The footer branding and
expanded destination form were checked at desktop and 360px widths. Both admin
builds, TypeScript, scoped ESLint and 383 focused shell/destination/style checks
pass for this follow-up.

## Shared-component consistency follow-up

A source audit found canvas-colored defaults in dialog, confirmation, outline
button and active-tab primitives; translucent neutral notices in Leads and
Destinations; an asymmetric Settings header override; and separate native-select
and contextual-help treatments. The primitives now own white card surfaces,
neutral notices use solid inset surfaces, and RegionHeader owns optional icons
and symmetric padding. Analytics and Leads share InfoTip with Radix positioning
and keyboard dismissal. Native single selects share a chevron (including RTL and
forced-colors behavior). One row-level divider replaces split header borders.

Browser checks confirm white Submission details on desktop and 360px, equal
10px top/bottom padding for account and destination headers, consistent 16px info
glyphs in 32px controls, and the restored date chevron. Focused tests include
portal surface defaults and keyboard open/dismiss/focus behavior for InfoTip.
