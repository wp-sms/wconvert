# The design system, regenerated from `resources/admin/src`

For current automated layout checks and review screenshots, use
[Admin visual contracts](../visual-tests/README.md). This older generator builds
design-reference cards and is not the CI regression suite.

This builds the Claude Design project **WConvert Admin** — the token layer, the
vocabulary CSS, and one preview card per screen per situation. It is a mirror of
the shipping admin, and everything in it is generated, because a hand-maintained
mirror is wrong from the first commit nobody remembered to copy across.

```bash
npm install --no-save playwright     # not a repo dependency; see below
./tools/design-system/build.sh       # everything, ~4 minutes
./tools/design-system/build.sh tokens shell   # or just some steps
```

Output goes to `tools/design-system/out/`, which is gitignored. Nothing here
ships: `/tools` is in `.distignore`.

## The steps

| Step | What it does |
|---|---|
| `assets` | `npm run build:admin` — the cards inline the compiled stylesheet, so a stale `public/admin/main.css` is a bundle showing the admin as it was two commits ago |
| `tokens` | Lifts `@theme inline` and `:root` out of `index.css`, plus a plain-CSS mirror |
| `shell` | Selects the vocabulary rules out of `index.css` **by selector**, not by line number |
| `prose` | Copies `GUIDELINES.md` and `BRIEF.md`, the two authored files |
| `screens` | Boots Playground, seeds a site, captures 32 cards |
| `sheet` | Tiles them into `contact-sheet-{ltr,rtl}.png` |

## The four situations, and where each comes from

ADR 0060 says a screen is **empty, loading, failed and full**. A seed produces
two of them; the other two are properties of a *request*, and they are forced on
**opposite sides of the wire**. That split is the one real design decision here:

- **empty** is the site before the seed runs and **full** is the same site
  after it — one boot, two phases, because they differ in rows rather than in
  anything about a request.
- **failed** is forced on the **server** (`seed/wconvert-ds-harness.php` filters
  `rest_pre_dispatch` off a cookie). It has to be: `messageOf()` exists because
  `apiFetch` rejects with WordPress's REST error body rather than an `Error`, so
  a 500 synthesised in the browser would prove the error path against a shape
  WordPress never sends.
- **loading** is forced in the **browser** (a Playwright route that is never
  fulfilled). It has to be: this harness boots Playground with `--workers=1`
  (`build/capture-screens.mjs`), so a request held open in PHP deadlocks the
  server rather than rendering a skeleton. `route.abort()` is wrong for the
  same job: that is the *failed* branch.

## Reading the output

`contact-sheet-ltr.png` and `contact-sheet-rtl.png` are the artefact. Four
screens down, four situations across — **two screens answering the same
situation differently is obvious in that grid and invisible in a diff of either
card**, which is the whole reason the cards exist.

The correction inlined in ADR 0060 about Milestones was found this way and not
by reading the code.

## Things that bit, so they do not bite again

- **wp-admin's `buttons.css` 301s** under Playground, WordPress's canonical
  redirect answers with the site's **front page at 200**, and `fetch` follows
  it — so "the stylesheet" becomes a WordPress home page inlined in a `<style>`
  tag whose own `</style>` closes it early. `build/capture-screens.mjs` resolves
  each handle against a candidate list and requires `content-type: text/css`.
- **Chromium never loads an offscreen iframe**, and `fullPage: true` grows the
  image rather than scrolling the page — so a short viewport screenshots one row
  of cards and three rows of white, which reads as three broken screens.
  `build/contact-sheet.mjs` sizes the viewport to the whole grid.
- **Mounting Pro replaces free's admin bundle**, so the capture mounts free
  only. `locked` upsells are a state only a free install is ever in.
- **RTL needs no language pack.** The harness sets the locale's text direction
  directly, which is enough for `<html dir="rtl">`, wp-admin's `-rtl`
  stylesheets and `useDirection()`. The strings stay English on purpose:
  direction is what is under test, and keeping the words identical is what makes
  the two grids comparable.

## Why Playwright is not in `devDependencies`

CI never runs this, and adding it would make every `npm ci` download a browser
driver for a script no workflow calls. `npm install --no-save playwright` when
you need it; the chromium binaries are already cached on a machine that has ever
run Playwright.
