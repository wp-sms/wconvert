# Changelog

All notable changes to WConvert are written here, newest first. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions
follow [Semantic Versioning](https://semver.org/).

Free and Pro carry their own version numbers (`free-vX.Y.Z` and `pro-vX.Y.Z`
tags). Each entry says which one it belongs to when it is not both.

The user-facing summary for WordPress.org stays in `readme.txt`; this file is
the full record for the team.

## [Unreleased]

### Changed

- Pro: the licence SDK (`veronalabs/wp-premium-sdk`) moves from 1.0.0-beta.8
  to 1.0.0-beta.9, which needs Nexus v2.3.1 or later (the update check sends
  the key in a header, not in the URL).
  - The account sign-in belongs to the site, so every administrator sees and
    can end the same sign-in; nobody is refused as "another administrator".
  - A copy the store has no activation for on this address
    (`not_activated_here`) gets no updates until it is activated here.
  - Replacing the key with the same key in other letter case no longer frees
    the seat it just took.
  - A sign-in error, such as an account with no licences (`no_licenses`),
    comes back to the License page with its code.

### Fixed

- Leads: when the server fails while the list is loading, the page shows
  one "Try again", and it reloads the list. The line saying how long
  submissions are kept now loads after the list. Before, its own error and
  "Try again" could appear first, and that button reloaded only that line,
  not the list.
- The loader size limits are now Free 14,720 B, Basic 25,472 B, Pro 27,040 B
  and Elite 27,712 B (gzip on Node 22), approved by Mostafa on 2026-10-12.
  The "is not" rule (#244) was measured on Node 20's gzip, and the template
  polish (#251: 14px minimum text, new close button) went in while CI was not
  running, so both had grown past the old limits unnoticed.
- The MySQL journey check loads its test destination type by file path, so it
  runs again now that the plugin starts from `packages/autoload.php`.
- The inline visual test looks for the "Phone view" switch, its name since
  ADR 0142.
- Changes asked for in the second WordPress.org plugin review (October 2026):
  - The content lock block and shortcode escape their markup after the
    `wconvert_content_region_html` filter as well, with the same rules as the
    content inside, so whatever a filter returns is escaped before output.
    The region's own `data-wconvert-*` attributes and Pro's attribute rename
    still come through.
  - The Pro "lock from here" divider block prints nothing instead of
    returning its saved content unescaped.
  - The hourly recovery sweep and the daily lead prune are scheduled on
    `init` instead of `plugins_loaded`. Scheduling earlier made WooCommerce
    load its translations too early, which WordPress logged as a
    `_load_textdomain_just_in_time` notice on every dashboard load.
- Changes asked for in the first WordPress.org plugin review (October 2026):
  - The spam-protection verification page loads its styles from a stylesheet
    printed by WordPress, not an inline `<style>` tag.
  - Data written into inline scripts (block editor list, admin settings,
    translations) is encoded with `JSON_HEX_TAG` and `JSON_HEX_AMP`, so a
    campaign name containing `</script>` cannot break out of the script.
  - The content lock block and shortcode pass the wrapped content through
    `wp_kses()` with the post rules, plus the iframe that video embeds use.
  - The three public REST routes (capture, beacon, verification page) declare
    `__return_true` as their permission callback, so they say they are public
    where they are registered.
  - Network activation on multisite is refused with a message. Activate
    WConvert on each site instead.
- On PHP older than 8.1, WConvert now shows a notice and stays paused instead
  of crashing the whole site with a parse error. The plugin header's
  `Requires PHP` only blocks activation from the Plugins screen, not a site
  that moves to an older PHP or a WP-CLI run on one.
- The design library build stubs `home_url()`, so `bin/build.sh` runs outside
  WordPress again.

## [1.0.0] - not yet released (in WordPress.org review)

### Added

- Pro: a License page (WConvert → License, and the header's plan badge) to
  activate by signing in to your account or with a key, see your sites and free
  one, swap or remove the key, and see whether updates and support are on. A
  licence never changes what Pro does: every problem state says Pro features keep
  working. Updates are offered only while the licence covers this site, and
  deleting Pro frees its site. A key in `WCONVERT_LICENSE_KEY` (optionally with
  `WCONVERT_LICENSE_CONTACT`) shows the site's owner only whether updates are on
  and who manages the licence. Pro refuses network activation, as free does.
- Pro: the Plugins screen shows a License link and one line when the licence
  needs something; Site Health gains a WConvert Pro license section.
- Free: "Already bought Pro?" links to the account's downloads, beside Explore Pro
  and under More with Pro.
- First public release: popups and inline forms created goal-first, a library
  of 68 designs, design import and export, a lead log with consent records and
  CSV export, analytics by goal with monthly targets, and MailPoet and WP SMS
  integrations.
