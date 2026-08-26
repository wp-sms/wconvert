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

* **Popups and inline forms**, rendered in the browser's top layer so a theme's
  stacking context cannot bury them.
* **A goal-first builder.** Playbooks are starting points, not templates you
  fight — every part stays editable.
* **A lead log** with CSV export, and per-Optin analytics: impressions,
  conversions, dismissals and a daily series.
* **Lead-magnet delivery by email**, with no third-party service required.
* **Consent captured as part of the form**, recorded with the wording that was
  on screen at the time.
* **WP SMS integration.** Where WP SMS is installed, a captured lead can create
  or fill in a contact there.

**No account, no phone-home**

WConvert has no licence key, sends no analytics anywhere, and stores no visitor
identifier. Everything it counts is a daily counter on your own site.

**The source is in the plugin**

Every piece of JavaScript this plugin ships is built from un-minified source
included in the download, under `resources/`. `public/loader/loader.js` is
built from `resources/loader/src`, and `public/admin/main.js` from
`resources/admin/src`. Nothing is fetched from elsewhere at build time or at
run time.

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

== Frequently Asked Questions ==

= Does it work without any other plugin? =

Yes. Capture, the lead log, CSV export, analytics and lead-magnet delivery by
email all work on a WordPress with nothing else installed.

= Does it store IP addresses or track visitors across pages? =

No. There is no visitor identifier of any kind, and no IP geolocation. The
analytics are daily counters per Optin.

= Where does the data go when someone converts? =

Into a table on your own site, and optionally to a destination you configure —
the lead-magnet email, or WP SMS if you have it installed. Nowhere else.

= How do I remove someone's data? =

WConvert registers with WordPress's own personal-data export and erasure tools.
An erasure request deletes the lead rows rather than anonymising them.

== Changelog ==

= 0.1.0 =
* First release.
