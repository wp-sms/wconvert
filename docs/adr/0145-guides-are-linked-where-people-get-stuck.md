# 0145: Guides are linked where people get stuck

Date: 2026-10-13. Status: accepted.
Extends [0144](0144-help-is-a-page.md). Amends
[0114](0114-analytics-exports-use-existing-site-tags.md) and
[0119](0119-actionable-reports-use-local-evidence-and-order-provenance.md)
(their bundled setup guides).

With the docs on wconvert.io, Help could reach every guide, but the screens
where a merchant actually gets stuck linked to none. Pro shipped two HTML
guides of its own, the Plugins screen and the readme pointed nowhere, and the
loader-missing notice said "reinstall" with no steps.

## Decisions

1. **One table of guides.** `resources/admin/src/shell/docs.ts` names every
   article the admin links to, by slug (`GUIDES`), with `docsUrl(guide,
   section?)` and `docsSearchUrl()`. It has no imports, so the block editor and
   Pro read it too. PHP has its twin, `WConvert\Support\Docs`. A slug or section
   is added only once it exists on the website's `docs.ts`.
2. **One link.** `shell/GuideLink` is a new-tab link with ↗, said aloud as
   opening a new tab. `InfoTip` and `EmptyState` take a `guide`, so most links
   live inside a tip or under an empty state's action and add nothing to a
   screen at rest (ADR 0042, 0136).
3. **Only where people get stuck.** Review & publish blockers and suspended
   campaigns, sending statuses and resends, a missing submission, the first
   empty Campaigns and Analytics screens, spam protection and hCaptcha keys,
   email filters, privacy, retention and personal-data requests, the quiz's
   answer conditions, A/B splits, an inline block that shows nothing, the
   "Why no popup?" report, License errors and updating by hand. Not every
   field. Pro's guides appear only on Pro's screens (ADR 0116).
4. **Pro bundles no guides.** Analytics settings and campaign sales link to
   `external-analytics-reference` and `campaign-sales-reporting`; `pro/docs/`
   is deleted and the artifact contract no longer requires it.
5. **WordPress's own surfaces.** Docs and Support under the free and Pro rows
   on the Plugins screen (`PluginRowMeta`); a "How to reinstall" link on the
   loader-missing notice; a guides section and a guide per matching FAQ answer
   in `readme.txt`.

## Consequences

- A guide renamed on the site is one edit in `docs.ts` (and `Docs.php` if PHP
  names it). Nothing checks the site automatically: the plugin fetches nothing
  (ADR 0144), so the check is by hand against the website's `docs.ts`.
- The analytics settings link to `#plausible` and `#google-tag-manager` on
  `external-analytics-reference`; the website adds those sections.
