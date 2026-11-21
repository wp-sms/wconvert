# 0193: Pro declares WConvert as a required plugin

Accepted 2026-11-21. From issue #433. Amends
[ADR 0030](0030-free-and-pro-release-on-independent-tags.md) inline, where it
says `WCONVERT_MIN_CORE` is the only statement one plugin makes about the
other.

## Context

Deactivating free WConvert while [[Pro]] is active stopped Pro without a word.
Pro explained only after the reload, through `BootGuard`'s admin notice, and by
then every campaign had already stopped showing. That is the "my popups
vanished" support ticket.

The issue proposed a custom confirm on the Plugins screen: "WConvert Pro runs on
WConvert. Deactivating it stops both", with **Keep it** and **Deactivate both**.

## Decision

**Pro's main file declares `Requires Plugins: wconvert`.** That is WordPress's
own plugin dependencies feature (6.5+; Pro already requires 6.9). With it,
WordPress itself:

- shows free's **Deactivate** as plain text while Pro is active, with "Required
  by: WConvert Pro" and core's note that the plugin can't be deactivated or
  deleted until the plugins requiring it are. Free's bulk checkbox is disabled
  too, so **Select all** + **Deactivate** turns off Pro and leaves free on.
  Free's Delete link is hidden while Pro is installed, active or not;
- refuses to activate Pro unless free is active: the row reads "Requires:
  WConvert" with an install link, and `activate_plugin()` returns
  `plugin_missing_dependencies`.

`wconvert` is free's wordpress.org slug and the top-level folder of its release
ZIP (`bin/build.sh`), so both a directory install and a ZIP upload satisfy it.
`tests/unit/Contract/ProRequiresFreeTest.php` reads the header the way WordPress
does, so the line can't be dropped silently.

**`BootGuard` stays as it is.** It still covers the two things the header
can't:

- a free that is too old for `WCONVERT_MIN_CORE`. The header names a plugin,
  not a version;
- free deactivated by a route WordPress doesn't guard. Only the screen guards:
  `deactivate_plugins()` never checks dependents, so `wp plugin deactivate
  wconvert` (WP-CLI 2.12 calls it directly) and a `deactivate-selected`
  request built outside the screen both succeed. The issue's rule is that bulk
  and WP-CLI work unprompted, so nothing is added to stop them. Pro then
  refuses to boot and its notice explains, as before; core adds its own "may
  not function correctly because required plugins are missing" under Pro's
  row.

## Why the header and not a custom warning

- **No code.** One header line replaces a script, a dialog, its strings and its
  tests in `PluginsScreen`.
- **It's the WordPress pattern.** Merchants see the same "Required by" and
  "Requires" wording every add-on that uses the header shows, in their own
  language, translated by core.
- **It also guards activation.** A confirm on Deactivate does nothing for a
  merchant who uploads Pro first. The header refuses that order up front, with
  an install link, instead of activating a Pro that can't boot.

## Trade-off

There is no **Deactivate both**. A merchant who wants both off deactivates Pro
first, then WConvert: two clicks on one screen. Every activation step this
repo runs already goes free first (`.github/workflows/php-tests.yml`,
`tools/visual-tests/recommendations-spike/blueprint.json`). The visual harness
loads both as mu-plugins, and `bin/plugin-check.sh` checks free alone, so
neither is affected.

## Rejected

- **The custom confirm the issue asked for.** It is more code for less
  coverage: it guards one link, can't stop the wrong activation order, and
  duplicates what core now does.
- **A deactivation survey.** Out of scope, as the issue says, and sending its
  answers anywhere is a consent question of its own.
