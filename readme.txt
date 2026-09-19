=== WConvert – Popups, Slide-ins and Inline Forms for Lead Capture ===
Contributors: veronalabs, mostafa.s1990, kashani
Tags: popup, lead capture, optin form, email list, conversion
Requires at least: 6.2
Tested up to: 7.1
Requires PHP: 8.1
Stable tag: 0.1.0
License: GPL-2.0+
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Capture leads with popups and inline forms you create goal-first, then see what each one did.

== Description ==

WConvert asks what you are trying to achieve before it asks what you want to
build. Pick a goal — grow an email list, grow an SMS list, deliver a lead
magnet, or promote a sale or offer — and it proposes the Playbook that serves
it: the placement, the trigger, the copy and the fields, already filled in.

**What it does**

* **Popups**, rendered in the browser's top layer so a theme's stacking context
  cannot bury them, and **inline forms** placed exactly where you want them
  with a block or a shortcode.
* **A goal-first builder.** Playbooks are starting points, not templates you
  fight — every part stays editable.
* **A lead log** with CSV export, and per-Optin analytics: impressions,
  conversions, dismissals and a daily series.
* **A start and end date**, so a sale switches itself off. Set them in your
  site's own time; nothing shows before the start or after the end, and neither
  is required — an Optin can run from a date, until a date, or between two.
* **A limit for the whole site**, on top of each Optin's own: stop showing a
  visitor anything once they close or sign up to something, cap how many they
  see in total, or put days between them. It is off until you set it, and no
  Optin can opt out of it.
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

It also records five dates about the site itself — when you first published an
Optin, when one was first shown, when someone first converted, whether what you
capture is reaching a destination, and the first time you changed something a
starting point suggested. They are how the Analytics screen can tell you which
step is stuck instead of showing you a wall of zeroes, they say nothing about
any individual visitor, and you can read the lot of them on that screen under
*What WConvert has recorded about this site*. None of it leaves your site.

WConvert makes no background catalog or analytics requests. An optional template
catalog is contacted only when an administrator explicitly checks, previews or
installs a pack; see Optional template catalog below. Every destination this free
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

Directories rather than filenames, because the admin bundle is split into
chunks whose names carry a content hash. Nothing is fetched from elsewhere at
build time or at run time.

**WConvert Pro**

Premium capabilities — the exit-intent, scroll-up and clicked-element triggers,
targeting by query parameter and by cart contents, floating bars and slide-ins,
A/B testing, the cart-recovery goal, and the email-service-provider and webhook
integrations — are supplied by a separate WConvert Pro plugin installed
alongside this one. None of that code is inside this download, and this plugin
is fully usable without it.

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
Optin** block and pick one of your published inline Optins by name — no id to
copy, and nothing to type.

Anywhere the block editor is not — the classic editor, a page builder, a
widget, or a theme template via `do_shortcode()` — use the shortcode instead.
The block shows you the exact shortcode for whichever Optin you picked, ready
to paste:

`[wconvert_optin id="YOUR_OPTIN_ID"]`

Popups, floating bars and slide-ins need none of this — they place themselves
on every page they are targeted at.

= Does it store IP addresses or track visitors across pages? =

No. There is no visitor identifier of any kind, and no IP geolocation. The
analytics are daily counters per Optin, and the five setup dates WConvert keeps
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

Under **WConvert → Settings → Data & privacy**, “Your data flow” gives
administrators a read-only explanation of this site's saved retention,
configured destinations, browser-local state and copies outside WConvert. The
same current facts inform WConvert's suggested text in WordPress's privacy-policy
guide; the site owner still reviews and publishes the policy that applies.

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

== Changelog ==

= 0.1.0 =
* First release.


== Optional template catalog ==

The bundled library works without an account or external service. If a site
operator configures a template catalog, administrators can explicitly check it,
preview a pack and install its designs in the editor. WConvert makes no background
catalog requests. The pack screen identifies the configured service before use.

These requests retrieve JSON template data. WConvert does not send campaigns,
leads or licence details; the service receives the web server IP and requested
URL as part of normal HTTP traffic. Installed designs remain available offline.
This first version supports free popup/inline designs with placeholders, and
accepts no downloaded executable code, fonts or media. No production service
endpoint is configured by default. A deployed service must publish its own terms
and privacy notice before it is offered as a default catalog.
