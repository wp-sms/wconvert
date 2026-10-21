=== WConvert: Popups and Inline Forms for Lead Capture ===
Contributors: veronalabs, mostafa.s1990, kashani
Tags: popup, lead capture, email list, optin form, newsletter
Requires at least: 6.8
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Turn visitors into subscribers and leads with popups and inline forms. Pick a goal, start from a ready-made design, and publish.

== Description ==

WConvert helps you collect email addresses, phone numbers and enquiries from
your WordPress site.

Tell it what you want, such as more newsletter subscribers or more enquiries,
and it gives you a ready-made popup or form. The words, fields and timing are
already filled in. Change anything you like, then publish.

No account to create and no outside service to connect. Your leads stay on your
own site. An optional online design library is used only after you allow it.

= Start from a goal =

Choose what you want to achieve, and WConvert suggests setups that do it:

* **Grow my email list.** Collect email addresses for your newsletter.
* **Grow my SMS list.** Collect phone numbers for text messages.
* **Collect enquiries.** Get quote requests and questions with contact details.
* **Deliver a lead magnet.** Email a guide or checklist when someone signs up.
* **Promote an offer or content.** Send visitors to a sale, a page or a post.

= Popups and inline forms =

* **Popups** that open on top of the page and look right with any theme.
* **Inline forms** inside your posts and pages. Add the WConvert campaign block,
  or paste a shortcode if you use another editor or a page builder.
* Every design works on phones as well as on desktop.

= Make it yours =

* **80 ready-made designs** to start from, included in the plugin. Their artwork
  is original and drawn in the page, so no image is loaded from another site.
* **More designs from the online WConvert library**, once you allow it. You add
  one to your designs with a click, and it then works offline like the rest.
* **Click any part of the design to change it**: words, colours, fields and
  buttons. Check how it looks on desktop and on a phone before you publish.
* **Move designs between sites.** Export a design to a file and import it
  somewhere else.

= Show it to the right people, at the right time =

* **When it opens:** as the page loads, after some seconds, after the visitor
  scrolls, or when they stop moving for a while.
* **Where it shows:** every page, or only the posts, pages, categories or
  addresses you pick.
* **Who sees it:** everyone, logged-in visitors, guests, or particular user
  roles such as customers or members.
* **Phones or desktop only**, and **opening hours** so it shows only during the
  times you choose.
* **Start and end dates**, so a sale campaign switches itself off on time.
* **Don't annoy anyone:** limit how often each visitor sees a campaign, and set
  one limit for your whole site, for example "nothing more once they sign up".
* **Find out why a popup didn't show:** add `?wconvert-inspect=1` to any page
  address while you are logged in as an admin.

= See what works =

* **What WConvert brought to your site**: leads captured, clicks and times
  shown, on one screen.
* **Results by goal and by campaign**, with a chart of each day.
* **Compare with the previous period** to see if you are growing.
* **Monthly targets**, for example 100 new subscribers this month.

Everything is counted on your own site. There is no tracking service and no
visitor ID. (The online design library counts how often each design is previewed or added,
with no site or visitor identifier; see External services.) WConvert also notes a few dates about your setup, such as when you
first published, so it can tell you which step needs attention. You can see
all of them on the Analytics screen.

= Your leads, in one place =

* **Every submission in a lead log**, with search, filters and CSV export.
* **The consent each visitor gave** is saved with their submission, using the
  exact words they saw on the form.
* **Send leads to MailPoet or WP SMS** if you use them.
* **Email a download link automatically** for lead magnets, with no extra
  service.
* **Privacy tools built in**: WordPress's personal-data export and erasure,
  a retention period you choose, and suggested text for your privacy policy.
* **Spam protection**: hidden-field checks and submission limits are built in.
  You can also turn on Cloudflare Turnstile, Google reCAPTCHA or hCaptcha.

= WConvert Pro =

WConvert works fully on its own. The separate WConvert Pro plugin adds:

* fullscreen popups, floating bars and slide-ins
* automatic placement inside your posts, and content locks that show the rest
  of a post after someone signs up
* quizzes with questions and results, including product picks for WooCommerce
* exit-intent, scroll-up and on-click triggers
* more targeting: where visitors came from, page address parameters and
  ad blockers
* A/B testing
* advanced spam filters
* campaign events for Google Analytics 4, Google Tag Manager or Plausible
* cart recovery and product recommendations for WooCommerce
* Mailchimp, Brevo and Mailtrap connections

None of that code is in this plugin.

= Guides and support =

Step-by-step guides for every feature are at [wconvert.io/docs](https://wconvert.io/docs/),
starting with [Create your first campaign](https://wconvert.io/docs/create-your-first-campaign/).
Inside WordPress, open **WConvert → Help**. For anything the guides don't
answer, [contact our team](https://wconvert.io/support/).

= Source code =

The admin screens, the visitor-facing loader and the editor block are built
with React, TypeScript and Vite. The compiled files in `public/` are generated
from the readable sources in the `resources/` folder of the [plugin's GitHub
repository](https://github.com/wp-sms/wconvert), which also holds the build
tools:

* `public/loader/` and `public/inspector/` come from `resources/loader/src`
* `public/admin/` comes from `resources/admin/src`
* `public/blocks/` comes from `resources/blocks/inline-optin/src`
* `public/phone/` comes from `resources/phone/src`
* `public/protection/` comes from `resources/protection/src`

To rebuild them, run `npm ci && npm run build:free` in a clone of the
repository, using Node.js 22.

== Installation ==

1. In your WordPress admin, go to **Plugins → Add New**, search for
   **WConvert**, and click **Install Now**, then **Activate**.
2. Open **WConvert** in the admin menu and click **Create campaign**.
3. Pick a goal, choose a setup, change anything you like, and publish.

**Multisite:** activate WConvert on each site on its own. Network activation is
not supported and is refused with a message.

== Frequently Asked Questions ==

= Do I need an account or another service? =

No. Everything works inside WordPress, with nothing else installed. MailPoet
and WP SMS are used only if you already have them. The online design library is
optional and asks before it loads anything; see External services.

= How do I put a form inside a post? =

In the block editor, add the **WConvert campaign** block and pick your campaign
by name. Not using the block editor? The block shows a shortcode you can paste
anywhere, such as a page builder, a widget or a theme file:

`[wconvert_optin id="YOUR_CAMPAIGN_ID"]`

Popups don't need this. They show on the pages you choose by themselves.
Guide: [Add an inline campaign with a block or shortcode](https://wconvert.io/docs/add-inline-campaign/).

= How do I stop a popup from showing again and again? =

Each campaign has its own limits, for example once per visit or never again
after someone signs up. Under **Settings** you can also set a limit for the
whole site, so visitors never see too many campaigns.
Guide: [Limit how often visitors see campaigns](https://wconvert.io/docs/limit-campaign-frequency/).

= Can I show a popup only on some pages? =

Yes. Pick the posts, pages, categories or page addresses where it should show,
or where it should not.
Guide: [Show a campaign on selected pages](https://wconvert.io/docs/show-on-selected-pages/).

= Will it slow down my site? =

If no campaign is published, WConvert adds nothing to your pages. When one is,
it loads a small script of about 15 KB, compressed. Forms with a phone field
add a small helper for phone numbers. Nothing is loaded from other sites unless
you turn on a bot-verification service.

= Does it store IP addresses or track visitors? =

No. There is no visitor ID and no tracking across pages. Results are daily
totals for each campaign. To slow down spam, a scrambled, one-way code made
from the visitor's network address is kept for a few minutes. The address
itself is never saved.
Guide: [What WConvert stores, sends and counts](https://wconvert.io/docs/what-wconvert-stores/).

= Where do my leads go? =

Into your own WordPress database, and to MailPoet or WP SMS if you set that up.
WConvert never sends your leads to us or to anyone else.
Guide: [Choose where submissions go](https://wconvert.io/docs/choose-where-submissions-go/).

= How do I delete someone's data? =

Use WordPress's own tools under **Tools → Erase Personal Data**. They delete
that person's submissions. For a phone number only, search it in
**WConvert → Leads** and delete the matching submissions there. Copies in other
services, downloaded files and backups need to be removed there too.

Under **WConvert → Settings → Data & privacy** you can see where visitor data
goes and set how long submissions are kept.
Guide: [Erase someone's personal data](https://wconvert.io/docs/erase-personal-data/).

= What happens if I delete the plugin? =

Deactivating changes nothing, and everything is still there when you turn it
back on. Deleting the plugin removes all of its data, including your leads, and
this cannot be undone. Export your leads to CSV from **WConvert → Leads** first
if you want to keep them.
Guide: [Deactivate or uninstall WConvert](https://wconvert.io/docs/deactivate-or-uninstall/).

== External services ==

= Optional Google Fonts =

Remote Google Fonts are disabled by default. In Settings → Data & privacy,
the site owner can enable them after acknowledging the browser connection.
When an eligible campaign is shown, WConvert requests only its declared, used
fonts that are not provided by the site's font list. The active editor preview
also loads these fonts when enabled. Selecting or importing a design does not
enable this setting. Gallery cards do not initiate font requests.

Stylesheets are requested from fonts.googleapis.com and font files from
fonts.gstatic.com. Google receives the browser's IP address and HTTP request
information. WConvert sends no form answers to this service. Installing fonts
in the WordPress Font Library is the locally hosted alternative. Disabling
remote delivery prevents new requests on freshly served pages; clear host/CDN
page caches after changing the setting. Existing browser caches may retain fonts.

Service: https://fonts.google.com/
Terms: https://policies.google.com/terms
Privacy: https://policies.google.com/privacy


WConvert works without an account or any external service, and nothing below is
contacted unless an administrator turns it on. There are two optional services.

**Online design library.** The designs included in the plugin work offline and
need nothing else. The online WConvert library at https://templates.wconvert.io
is on by default but **asks first**: before anything is fetched, the design
picker shows a one-time question, and the answer is kept in Settings → Data &
privacy, where it can be changed at any time. Nothing is fetched on activation,
from cron, on the dashboard or on your site's pages. While the picker is open,
WConvert checks for new designs at most twice a day.

What is fetched: JSON design and setup data and PNG, JPEG or WebP images. Every
file is checked against a SHA-256 checksum, and nothing executable or any font
is downloaded. A design you add is stored under `wp-content/uploads/` and keeps
working offline. Your browser loads design thumbnails from the same address with
no referrer, so the service sees your browser's IP address.

What is sent: requests from the free plugin carry no licence key, site address,
campaign, lead or visitor data; the server's IP address, the requested address
and a fixed user agent are all the service sees. When a design is previewed or added, the
service counts that download for that design, with no site or visitor
identifier. **WConvert Pro** also sends its licence key and your site's domain to
the same service when you add a Pro design, and the service asks the WConvert
licence server (Nexus, at https://my.wconvert.io) to issue a five-minute pass for
those files.

The service runs on Cloudflare, which processes these requests for us. Its
request logs are kept for at most 7 days and download counts for 3 months.

To turn the library off for the whole site, add
`define( 'WCONVERT_TEMPLATE_CATALOG', false );` to `wp-config.php`, or return
`false` from the `wconvert_template_catalog` filter. An operator can also point
it at another catalogue address; the trusted recipient of a Pro licence key does
not change with it.

Service terms: https://wconvert.io/terms/
Privacy policy: https://wconvert.io/privacy/

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
* DM Sans font — SIL Open Font License 1.1; its licence ships as
  `public/admin/fonts/OFL-DM-Sans.txt`

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
  of 80 designs, design import and export, a lead log with consent records and
  CSV export, analytics by goal with monthly targets, and MailPoet and WP SMS
  integrations.

== Upgrade Notice ==

= 1.0.0 =
First public release.
