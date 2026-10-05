=== WConvert – Popups and Inline Forms for Lead Capture ===
Contributors: veronalabs, mostafa.s1990, kashani
Tags: popup, lead capture, optin form, email list, conversion
Requires at least: 6.8
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Capture leads with popups and inline forms you create goal-first, then see what each one did.

== Description ==

WConvert asks what you are trying to achieve before it asks what you want to
build. Pick a goal — grow an email list, grow an SMS list, collect enquiries,
deliver a lead magnet, or promote a sale or offer — and it proposes the ready-made
setups that serve it: the placement, the trigger, the copy and the fields,
already filled in. Every one of them becomes a Campaign you can change.

**What it does**

* **Popups**, rendered in the browser's top layer so a theme's stacking context
  cannot bury them, and **inline forms** placed exactly where you want them
  with the Inline Campaign block or a shortcode.
* **A goal-first builder.** Ready-made setups are starting points, not
  templates you fight — every part of the design stays editable.
* **A design library** of 68 ready-made designs for popups and inline forms.
  Their artwork is original and drawn in the page, so no image is fetched from
  anywhere.
* **Design import and export.** Save a design to a file and import it on
  another site. An imported design is checked against what that site can
  display before it is used.
* **A lead log** with CSV export, showing each submission with the consent
  wording the visitor saw.
* **Analytics** that start from what WConvert brought to your site: results by
  goal, monthly targets, a comparison with the previous period, and for each
  Campaign its appearances, conversions, dismissals and a daily series.
* **A start and end date**, so a sale switches itself off. Set them in your
  site's own time; nothing shows before the start or after the end, and neither
  is required — a Campaign can run from a date, until a date, or between two.
* **A limit for the whole site**, on top of each Campaign's own: stop showing a
  visitor anything once they close or sign up to something, cap how many they
  see in total, or put days between them. It is off until you set it, and no
  Campaign can opt out of it.
* **Hours of the day**, so a popup can keep to your opening hours instead of
  greeting people at three in the morning. It is your site's own clock, and a
  window may run past midnight.
* **Show it only to particular roles** — customers, subscribers, or whatever
  your site registered. Holding any one of the roles you pick is enough, and
  membership or LMS plugins can add their own levels to the same list.
* **Lead-magnet delivery by email**, with no third-party service required.
* **Consent captured as part of the form**, recorded with the wording that was
  on screen at the time.
* **See why a popup did or did not show**, on the page itself rather than in a
  simulator: add `?wconvert-inspect=1` to any URL on your site while signed in
  as an administrator.
* **MailPoet integration.** Where MailPoet is installed, a captured lead is
  added to the lists you choose by name. Nobody who unsubscribed is ever put
  back, and whether a new subscriber has to confirm stays MailPoet's own
  setting.
* **WP SMS integration.** Where WP SMS is installed, a captured lead can create
  or fill in a contact there.

**No account, no phone-home**

WConvert has no licence key, sends no analytics anywhere, and stores no visitor
identifier. Everything it counts is a daily counter on your own site.

It also records five dates about the site itself — when you first published a
Campaign, when one was first shown, when someone first converted, whether what you
capture is reaching a destination, and the first time you changed something a
starting point suggested. They are how the Analytics screen can tell you which
step is stuck instead of showing you a wall of zeroes, they say nothing about
any individual visitor, and you can read the lot of them on that screen under
*What WConvert has recorded about this site*. None of it leaves your site.

WConvert makes no background catalog or analytics requests. An optional template
catalog is contacted only when an administrator explicitly checks, previews or
installs a pack; see External services below. Every destination this free
plugin can send a lead to is already on your site — the lead-magnet email,
MailPoet, WP SMS — which is why the email-service-provider integrations are in
WConvert Pro rather than here. What your own mail or newsletter plugin does
afterwards with a message you asked it to send is between you and however you
have set it up.

**The source is in the plugin**

Every piece of JavaScript this plugin ships is built from un-minified source
included in the download, under `resources/`:

* everything in `public/loader/` and `public/inspector/`, from
  `resources/loader/src`
* everything in `public/admin/`, from `resources/admin/src`
* everything in `public/blocks/`, from `resources/blocks/inline-optin/src`
* everything in `public/phone/`, from `resources/phone/src`
* everything in `public/protection/`, from `resources/protection/src`

Directories rather than filenames, because the admin bundle is split into
chunks whose names carry a content hash. Everything the plugin runs ships in
this download; the only services it can contact are optional, off by default,
and listed under External services below.

**Building from source.** The build files ship with the plugin —
`package.json`, `package-lock.json`, `tsconfig.json`, the `vite.*.mjs`
configs, `composer.json` and `composer.lock`. With Node.js 22 and
Composer, run these from the plugin's directory:

`npm ci && npm run build:free`

`composer install --no-dev`

The first rebuilds everything under `public/`; the second rebuilds `vendor/`.

**WConvert Pro**

A separate WConvert Pro plugin, installed alongside this one, adds:

* fullscreen campaigns, floating bars and slide-ins
* automatic inline placement before, after or within your posts, and content
  locks that reveal the rest of a post after a signup
* questions-and-results journeys, with WooCommerce product results
* the exit-intent, scroll-up and clicked-element triggers
* advanced targeting conditions, including referrer, query parameter and
  ad-blocker detection
* A/B testing
* advanced spam filters
* Campaign events sent to your existing Google Analytics 4, Google Tag Manager
  or Plausible script
* cart recovery and product recommendations for WooCommerce
* Mailchimp and Brevo destinations

None of that code is inside this download, and this plugin is fully usable
without it.

== Installation ==

1. Upload the plugin to `/wp-content/plugins/wconvert`, or install it from
   Plugins → Add New.
2. Activate it.
3. Open **WConvert** in the admin menu and pick a goal.

**Multisite is not supported in this version.** Activate WConvert on each site
individually rather than across the network. Network activation only sets up
the site whose dashboard was open at the time, so any site nobody has visited
the admin of will have no database tables while its front end is live.

**Deleting the plugin deletes its data.** Deactivating WConvert changes
nothing — your leads, settings and destinations are all still there when you
turn it back on. Using Delete in WordPress removes the plugin's three database
tables and all of its options, including every captured lead, and that cannot
be undone. Export your leads to CSV from **WConvert → Leads** first if you want
to keep them.

== Frequently Asked Questions ==

= Does it work without any other plugin? =

Yes. Capture, the lead log, CSV export, analytics and lead-magnet delivery by
email all work on a WordPress with nothing else installed. MailPoet and WP SMS
are used if they are there and are never required.

= How do I put an inline form on a page? =

Two ways, and they do the same thing. In the block editor, add the **Inline
Campaign** block and pick one of your published inline Campaigns by name — no
id to copy, and nothing to type.

Anywhere the block editor is not — the classic editor, a page builder, a
widget, or a theme template via `do_shortcode()` — use the shortcode instead.
The block shows you the exact shortcode for whichever Campaign you picked,
ready to paste:

`[wconvert_optin id="YOUR_CAMPAIGN_ID"]`

Popups need none of this — they place themselves on every page they are
targeted at.

= Does it store IP addresses or track visitors across pages? =

No. There is no visitor identifier of any kind, and no IP geolocation. The
analytics are daily counters per Campaign, and the five setup dates WConvert keeps
are facts about the site rather than about anybody — you can read exactly what
they are on the Analytics screen. A site-specific one-way hash derived from the
network address is kept for one minute to rate-limit anonymous counting; the
network address itself is not stored. Deleting the plugin deletes all of it.

= Where does the data go when someone converts? =

Into a table on your own site, and optionally to a destination you configure —
the lead-magnet email, MailPoet, or WP SMS if you have them installed. All
three of those are on your own site — WConvert sends your leads to no service
of ours and to no third party.

= How do I remove someone's data? =

WConvert registers with WordPress's own personal-data export and erasure tools.
An erasure request deletes the lead rows rather than anonymising them.
WordPress addresses those requests by email. For a verified phone-only request,
search the complete phone number in **WConvert → Leads**, export the matching
submissions if needed, then use the exact-match deletion action. It deletes all
WConvert submissions directly carrying that phone across every campaign. Copies
in destinations, downloaded files, email logs and backups must be handled there.

Under **WConvert → Settings → Data & privacy**, “Where visitor data goes” gives
administrators a read-only explanation of this site's saved retention,
configured destinations, browser-local state and copies outside WConvert. The
same current facts inform WConvert's suggested text in WordPress's privacy-policy
guide; the site owner still reviews and publishes the policy that applies.

Privacy guidance is on by default. It adds a short Privacy Policy notice to new
Campaign setups and checks it in the editor before publishing. Turn it off in
**WConvert → Settings → Data & privacy** for simpler future drafts and a simpler
editor. Existing Campaigns do not change, and export, erasure, retention and
WordPress privacy tools stay available.

= What happens to my data if I remove the plugin? =

Deactivating changes nothing: everything is still there when you activate it
again. Deleting the plugin removes all of it — the three database tables and
every option, including your captured leads and your configured destinations.
There is no setting to keep the data behind, and it cannot be recovered
afterwards, so export your leads to CSV from **WConvert → Leads** before you
delete if you might want them.

= Does it work on multisite? =

Not in this version. Activate it per site rather than across the network. A
network activation only creates tables for the one site that was open at the
time, and the plugin will say so in the network admin.

== External services ==

WConvert works without an account or any external service, and nothing below is
contacted unless an administrator turns it on. There are two optional services.

**Template catalog.** The bundled design library works offline. If a site
operator configures a template catalog, administrators can explicitly check it,
preview a pack and install its designs in the editor. WConvert makes no
background catalog requests, and the pack screen identifies the configured
service before use. No catalog is configured by default; a deployed service must
publish its own terms and privacy notice before it is offered as a default.

A catalog request retrieves JSON template data and, for packs that include
them, the pack's images. Each image must be a PNG, JPEG or WebP file of at most
5 MB whose size and SHA-256 checksum match the pack's manifest; anything else is
rejected, and accepted images are stored under `wp-content/uploads/` so
installed designs keep working offline. No executable code or fonts are ever
downloaded. WConvert does not send campaigns, leads or licence details; the
service receives the web server's IP address and the requested URL as part of
normal HTTP traffic.

**Bot verification.** Hidden-field checks and submission limits are built in.
In Settings → Spam protection, administrators may enable one verification
service using their own account and keys: Cloudflare Turnstile Managed, Google
reCAPTCHA v2 checkbox, or hCaptcha. No service is selected by default. Provider
charges and quotas are separate from WConvert.

The selected service loads when a form needs verification or an administrator
runs Test saved setup. Its script receives browser and network information,
including the visitor's IP address. WConvert sends the verification token and
required credentials from the server to that service; it does not forward the
form's email, phone or other captured answers. The server also checks the
provider response before accepting a protected form. Visitors can retry failed
verification without losing their entered fields. Administrators should review
the selected service's terms and their site's privacy notice before enabling it.

* Cloudflare Turnstile: https://www.cloudflare.com/products/turnstile/
  Terms: https://www.cloudflare.com/website-terms/
  Privacy: https://www.cloudflare.com/turnstile-privacy-policy/
* Google reCAPTCHA: https://www.google.com/recaptcha/about/
  Terms: https://policies.google.com/terms
  Privacy: https://policies.google.com/privacy
* hCaptcha: https://www.hcaptcha.com/
  Terms: https://www.hcaptcha.com/terms
  Privacy: https://www.hcaptcha.com/privacy

Queued resource emails are limited to one successful send per recipient and
resource within ten minutes. Separate submissions remain separate leads.

== Third-party libraries ==

The built JavaScript and CSS bundle these open-source libraries. Their sources
are installed by `npm ci` from `package-lock.json`.

* React and ReactDOM 19 — MIT. The admin screens bundle their own React 19
  rather than using the copy WordPress provides, because WordPress 6.8 ships
  React 18. It runs only on WConvert's own admin screens; the visitor-facing
  loader and the block editor bundle use no React of their own.
* Radix UI (`radix-ui`) — MIT
* React Flow (`@xyflow/react`) — MIT
* dagre (`@dagrejs/dagre`) — MIT
* React Flow Smart Edge (`@tisoap/react-flow-smart-edge`) — MIT
* react-colorful — MIT
* tailwind-merge — MIT
* clsx — MIT
* Tailwind CSS and tw-animate-css (generated CSS) — MIT
* lite-phone-input — MIT; its notice ships in `resources/phone/`
* Lucide icons (`lucide-react`) — ISC
* class-variance-authority — Apache-2.0
* Pragmatic drag and drop (`@atlaskit/pragmatic-drag-and-drop`) — Apache-2.0
* DM Sans font — SIL Open Font License 1.1; its licence ships in
  `resources/admin/src/assets/fonts/`

PHP:

* Action Scheduler (`woocommerce/action-scheduler`), installed by Composer into
  `vendor/` — GPL-3.0-or-later, which is compatible with this plugin's
  GPL-2.0-or-later licence when distributed together.

Template artwork: every illustration in the design library is original work
made for WConvert, drawn as inline SVG, and licensed GPL-2.0-or-later with the
rest of the plugin. The library contains no photographs and no third-party
logos.

== Screenshots ==

1. Lead capture that looks like your site: one popup, on desktop and on a phone.
2. Start from what you want to achieve: pick a goal, then a ready-made setup.
3. Change any word, colour or field, right beside the design.
4. Forms right where your readers are, placed with the Inline Campaign block.
5. See what each campaign brings in, compared with the previous period.
6. Every lead, with the consent wording the visitor saw.

== Changelog ==

= 1.0.0 =
* First public release: popups and inline forms created goal-first, a library
  of 68 designs, design import and export, a lead log with consent records and
  CSV export, analytics by goal with monthly targets, and MailPoet and WP SMS
  integrations.

== Upgrade Notice ==

= 1.0.0 =
First public release.
