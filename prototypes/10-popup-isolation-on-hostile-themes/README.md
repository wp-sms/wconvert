# Prototype: popup isolation on hostile themes (issue #10)

**Throwaway.** The output is [`FINDINGS.md`](FINDINGS.md), not this code. Nothing
here ships. The one part worth keeping past this branch is
[`src/ship/dialog.js`](src/ship/dialog.js) — the shape the real renderer should
take, at 2,098 bytes gzipped including the template's own CSS.

## The question

How does an Optin render correctly on a theme that knows nothing about it? Shadow
DOM, scoped CSS with heavy specificity, or an iframe — and what does the winner cost
against #9's 8KB loader budget?

**Answer: a modal `<dialog>` holding a closed shadow root.** The three-way framing
turned out to be answering the wrong question — see FINDINGS §3.

## What is here

```
wconvert-proto-10.php     the WP side: enqueues one mode onto a real theme, serves the
                          reference render, and injects the synthetic hostile theme
src/template.js           ONE markup + CSS pair, used verbatim by every mode and by the
                          reference. `@R@` is the root selector each mode substitutes.
src/isolate.js            the 11 strategies behind one mount() interface
src/a11y.js               focus trap / Esc / restore / inert, written once per container
src/proto.js              entry point + the debug API the harness drives
src/ship/{dialog,shadow,scoped,iframe}.js
                          shipping-shaped implementations, built only to measure what
                          each strategy would really cost. dialog.js is the recommendation.
build.sh                  bundles, emits the reference render, prints the size tables
harness/lib.mjs           browser plumbing + diff(): leakage is a computed-style delta
                          from the reference, never a judgement call
harness/matrix-themes.mjs   10 real theme/plugin combinations x 11 modes
harness/matrix-hostile.mjs  the synthetic hostile theme, 6 escalating levels
harness/fixed-positioning.mjs  THE FINDING: a 4000px page sampled all the way down
harness/z-index-war.mjs     clickable vs actually-on-top; they differ
harness/a11y.mjs            real key presses, with the hand-written a11y layer on
harness/a11y-free.mjs       ...and with it off, to see what the CONTAINER gives you
harness/focus-restore.mjs   opener focused first, so restoration is really measured
harness/rtl.mjs             under a real fa_IR locale, not a bolted-on dir attribute
harness/clip.mjs            mounted inside a clipping, transformed ancestor
results/                    raw output of every pass; FINDINGS.md quotes these
```

## Modes

| mode | container | reset |
|---|---|---|
| `shadow` | closed shadow root | `:host { all: initial }` — the naive version |
| `shadow-dir` | closed shadow root | + `direction: inherit` (turned out unnecessary) |
| `shadow-fixed` | closed shadow root | + `@font-face` hoisted to the document |
| `shadow-armour` | closed shadow root | + the host reset made `!important` |
| `shadow-bare` | closed shadow root | no reset at all |
| `shadow-open` | **open** shadow root | `all: initial` |
| `scoped` | namespaced `<div>` | `all: revert` — the strongest non-shadow reset |
| `scoped-imp` | namespaced `<div>` | + `!important` on every declaration |
| `iframe` | `srcdoc` iframe | n/a |
| `shadow-html` | closed shadow root on `<html>` | armoured — escapes a `body` transform |
| **`dialog`** | **modal `<dialog>` + closed shadow root** | **armoured — the recommendation** |

## Run it

```sh
./build.sh          # size tables + dist/proto.js + the reference render
```

Everything else needs the Local site running and a wp-cli wrapper that can reach
Local's MySQL socket:

```sh
cat > /tmp/wpc <<'SH'
#!/bin/zsh
php -d error_reporting=E_ALL^E_DEPRECATED \
    -d mysqli.default_socket="$HOME/Library/Application Support/Local/run/<id>/mysql/mysqld.sock" \
    /opt/homebrew/bin/wp --path="$HOME/Local Sites/wconvert/app/public" "$@"
SH
chmod +x /tmp/wpc

# WordPress does not scan two levels deep, so load the prototype as an mu-plugin
cat > "$HOME/Local Sites/wconvert/app/public/wp-content/mu-plugins/wconvert-proto-10-bootstrap.php" <<'PHP'
<?php require_once WP_PLUGIN_DIR . '/wconvert/prototypes/10-popup-isolation-on-hostile-themes/wconvert-proto-10.php';
PHP

WCV_WP=/tmp/wpc ./harness/run-all.sh     # every pass -> results/
```

`harness/node_modules` is a symlink to a scratch install of `playwright`; make your
own with `npm i playwright`.

Look at one by hand:

```
http://wconvert.local/?wcv10=dialog                    the recommendation
http://wconvert.local/?wcv10=scoped&wcv10_hostile=3    scoped CSS losing, visibly
http://wconvert.local/?wcv10=shadow&wcv10_hostile=6    shadow surviving the CSS, not the transform
http://wconvert.local/?wcv10_ref=1                     the reference render, no theme
```

Query parameters: `wcv10_hostile=1..6`, `wcv10_rtl=1`, `wcv10_z=<n>`,
`wcv10_noa11y=1`, `wcv10_clip=1`, `wcv10_inline=<selector>`.

## Themes and plugins the matrix needs

Installed from wp.org: Astra, OceanWP, GeneratePress, Kadence, Storefront,
Hello Elementor, Elementor, Cookie Notice, CookieYes, plus the bundled
Twenty Twenty-Three/Four/Five. The `fa_IR` language pack is needed for the RTL pass.

## Cleaning up afterwards

```sh
/tmp/wpc site switch-language en_US
/tmp/wpc theme activate twentytwentyfive
/tmp/wpc plugin deactivate elementor cookie-notice cookie-law-info
rm "$HOME/Local Sites/wconvert/app/public/wp-content/mu-plugins/wconvert-proto-10-bootstrap.php"
```
