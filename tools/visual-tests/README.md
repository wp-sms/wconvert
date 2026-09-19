# Admin visual contracts

The suite checks the shipping admin bundle inside disposable WordPress 6.8.3
with PHP 8.1, real WordPress CSS and self-hosted fonts. It never connects to the
saved Local site. Playground, Playwright and Chromium are development tools only.

```sh
composer install
npm ci
npx playwright install chromium
npm run build:admin
npm run test:visual
```

`test:visual` owns port 9413 and refuses to reuse an existing server. Stop a
manual `visual:serve` process before running the suite. CI installs Chromium's
system dependencies and uploads `tools/visual-tests/out/` for 14 days.

## Coverage

68 cases: Campaigns, Analytics, Leads and Connections & destinations in full,
empty, loading and failed states at 1440×1100 and 390×844, each in LTR and RTL;
four additional interaction cases cover tooltips, monthly-target dialogs,
submission details, campaign menus, expanded destination settings and footer help.

Assertions gate horizontal overflow, shared typography, light headings, the
continuous header divider, the hidden WordPress footer, publisher link styling,
symmetric card-header padding, white goal cards and overlay surfaces, control
alignment, select chevrons, help-icon dimensions, overlay bounds, Escape/focus
return, and recovery from failed reads. Every case attaches a full-page PNG;
failed tests retain a Playwright trace.

These are **geometry/style regression checks with review screenshots**, not
pixel-diff goldens. They catch the named design contracts without masking text or
accepting a changed baseline automatically. They do not replace human review of
new designs, long translations, or browser-specific rendering.

## Manual review

```sh
npm run visual:serve
```

1. Visit `http://127.0.0.1:9413/?wconvert_visual_seed=1` once.
2. Sign in at `/wp-login.php` using the disposable `admin` / `password` account.
3. Open `/?wconvert_visual_controls=1` to set direction and full/empty/loading/failed.
4. Open `/?wconvert_visual_viewport=mobile` or `=desktop` for exact-size same-origin
   frames, useful when a browser does not resize background tabs. Normal app
   navigation works inside the frame.
5. To check recovery without reloading the affected page, clear the failure state
   in a separate controls tab, then press that page's retry button.

Full data is seeded through the product repositories. Empty responses retain real
REST shapes with collections cleared. Failed reads are real WordPress REST errors.
Loading is held by an api-fetch middleware in the browser, so the single PHP
worker remains free. Mail is suppressed on this disposable site.

Playground's SQLite translator currently leaves MySQL's `<=>` operator intact.
The harness expands the campaign summary's one null-safe comparison into its
boolean equivalent. This is a test-environment shim; production SQL is unchanged.
This suite does not claim MySQL compatibility coverage. Use the `bin/verify-*`
checks described in the repository README against a disposable MySQL site for that.

## Workflow review, 2026-09-19

Browser review on the disposable site covered creating a blank email campaign,
choosing a design, explicitly selecting local-only collection, reviewing and
publishing, submitting `workflow-qa@example.com` on the visitor page, opening the
saved submission, filtering by that email and observing the matching CSV download.

This found and fixed the first-design default: a blank draft now starts from the
chosen design's samples instead of carrying an empty form. Existing designs still
default to keeping their content. A regression test covers that distinction.
Retrying Leads also refreshes and clears a failed retention summary, with a
separate recovery regression test.

The review also checked the four page states, RTL mobile overlay bounds, 48px
analytics controls, 16px help icons, white dialogs and symmetric destination
headers. The CLI suite was discovered (68 cases), but was not executed in this
agent session; browser interactions used the available Codex browser runner.
The complete CLI run remains a CI validation step after these commits are pushed.
# Fullscreen Pro checks

After `npm run build`, run `npx playwright test -c tools/visual-tests/fullscreen.config.mjs`.
This starts a separate disposable WordPress with both plugins on port 9414.
Never mount the fixture mu-plugins into a saved site. Browser tests cover native
modal behavior and real capture; device keyboard and screen-reader release QA
remain manual.

## Automatic inline Pro checks

After `npm run build`, run `npm run test:visual:inline`. This starts a separate
disposable WordPress with both plugins on port 9415. The fixture exercises real
content hooks; it never edits a saved Local site. Automatic placement uses the
existing viewport-based impression and capture paths. Normal-flow insertion can
shift article content; mobile and real-theme checks remain important.
