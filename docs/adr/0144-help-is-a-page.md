# 0144: Help is a page

Date: 2026-10-13. Status: accepted.
Amends [0097](0097-harbor-is-the-shared-admin-frame.md) (`HELP_URLS` gets real
addresses; Help is also a page), [0132](0132-every-screen-answers-its-first-question.md)
(decision 26: Help holds help, now in three places),
[0035](0035-the-admin-owns-its-page.md) (free has a submenu) and
[0143](0143-license-page-and-updater.md) (decision 7: free names the submenu's
first item and owns the submenu highlight).

Help was a popover in the header and the footer whose four links were all `#`.
Merchants had nowhere to search the guides, no list of common fixes, and no
clear way to send support what it needs. The approved clickable prototype is the
review gate: claude.ai/artifact/EnhKuiKMx37rYDJDLcffgE (v5).

## Decisions

1. **WConvert → Help is a page, in Free and Pro.** A WordPress submenu entry,
   `admin.php?page=wconvert#help`, registered by free beside Campaigns; Pro's
   License follows it. The page is free's own `registerPage()` entry, made in
   `App.tsx` so Pro's entry, which imports the app, has it too. It has no tab,
   like License: it is opened a few times a year.
2. **One Help, three doors.** The header ?, the footer's Help and the page share
   one `HELP_URLS` table. The popover gains the page's search field and *Open
   the Help page*, left out on the page itself. There the ? is marked current
   with the frame's tint and its citron signal, as an active tab is; an outline
   read as keyboard focus.
3. **Search belongs to the website.** The field is a plain GET form to
   `https://wconvert.io/docs/?q=…`, opening a new tab. The plugin bundles no
   index and fetches nothing. Rejected: shipping a docs snapshot (stale, and the
   owner wants the site to own search); fetching a JSON index at runtime (an
   external request that needs readme disclosure, for less than the site's own
   search does); loading Pagefind from wconvert.io (remote JS and WASM in
   wp-admin, which wp.org refuses). The site reads `?q=` and opens its Pagefind
   search filled in.
4. **The page fetches nothing.** Start here (the first-campaign guide), eight
   topics, the troubleshooting guides as quick fixes, and Still stuck? with
   Contact support are all links to wconvert.io in a new tab. The Pro
   troubleshooting guide and "Contact Pro support" appear only where Pro is
   installed (ADR 0116). No upsell sits on the page.
5. **Site details are Site Health's.** No copy-site-details box: WordPress's
   *Tools → Site Health → Info → Copy site info to clipboard* already carries
   WordPress, PHP, the theme and the plugins, and the page points there. Free
   adds a **WConvert** section (version, plan, published and draft campaigns,
   `SiteHealthInfo`), built only when Site Health asks; Pro's licence section
   was already there. Nothing is stored.
6. **What's new** links to the plugin's wordpress.org changelog until
   wconvert.io has one; changing it is one line in `HELP_URLS`.

## Consequences

- *Extended by [ADR 0145](0145-guides-are-linked-where-people-get-stuck.md):*
  `HELP_URLS` reads its docs addresses from `shell/docs.ts`, the one table of
  guides the rest of the admin links to.

- `shell/menuHighlight.ts` (`markSubmenuCurrent(hash)`) replaces Pro's
  License-only copy; both pages call it.
- `lib/interpolate.tsx` is shared by the display-rules sentence and the Help
  page's Site Health line.
