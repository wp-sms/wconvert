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
build. Pick a goal — grow an email list, deliver a lead magnet, announce a
sale, send visitors to an offer — and it proposes the Playbook that serves it:
the placement, the trigger, the copy and the fields, already filled in.

**What it does**

* **Popups**, rendered in the browser's top layer so a theme's stacking context
  cannot bury them, and **inline forms** placed exactly where you want them
  with a block or a shortcode.
* **A goal-first builder.** Playbooks are starting points, not templates you
  fight — every part stays editable.
* **A lead log** with CSV export, and per-Optin analytics: impressions,
  conversions, dismissals and a daily series.
* **Lead-magnet delivery by email**, with no third-party service required.
* **Consent captured as part of the form**, recorded with the wording that was
  on screen at the time.
* **MailPoet integration.** Where MailPoet is installed, a captured lead is
  added to the lists you choose by name. Nobody who unsubscribed is ever put
  back, and whether a new subscriber has to confirm stays MailPoet's own
  setting.
* **WP SMS integration.** Where WP SMS is installed, a captured lead can create
  or fill in a contact there.

**No account, no phone-home**

WConvert has no licence key, sends no analytics anywhere, and stores no visitor
identifier. Everything it counts is a daily counter on your own site.

WConvert itself contacts nothing on the internet. Every destination this free
plugin can send a lead to is already on your site — the lead-magnet email,
MailPoet, WP SMS — which is why the email-service-provider integrations are in
WConvert Pro rather than here. What your own mail or newsletter plugin does
afterwards with a message you asked it to send is between you and however you
have set it up.

**The source is in the plugin**

Every piece of JavaScript this plugin ships is built from un-minified source
included in the download, under `resources/`. `public/loader/loader.js` is
built from `resources/loader/src`, `public/admin/main-*.js` from
`resources/admin/src`, and `public/blocks/inline-optin.js` from
`resources/blocks/inline-optin/src`. Nothing is fetched from elsewhere at build
time or at run time.

**WConvert Pro**

Premium capabilities — exit-intent and scroll-up triggers, floating bars and
slide-ins, A/B testing, and the email-service-provider integrations — are
supplied by a separate WConvert Pro plugin installed alongside this one. None
of that code is inside this download, and this plugin is fully usable without
it.

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
analytics are daily counters per Optin.

= Where does the data go when someone converts? =

Into a table on your own site, and optionally to a destination you configure —
the lead-magnet email, MailPoet, or WP SMS if you have them installed. All
three of those are on your own site — WConvert sends your leads to no service
of ours and to no third party.

= How do I remove someone's data? =

WConvert registers with WordPress's own personal-data export and erasure tools.
An erasure request deletes the lead rows rather than anonymising them.

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
