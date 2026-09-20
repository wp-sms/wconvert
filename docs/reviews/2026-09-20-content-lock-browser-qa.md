# Content lock browser QA: 20 September 2026

This review uses the disposable WordPress Playground on port 9423 with the Pro
plugin mounted from the working tree. It does not touch the saved Local site.
The new Playwright coverage is in
[`tools/visual-tests/content-lock-ux.spec.mjs`](../../tools/visual-tests/content-lock-ux.spec.mjs),
with its isolated launcher in
[`content-lock-ux.config.mjs`](../../tools/visual-tests/content-lock-ux.config.mjs).

## Automated browser review

The browser exercised the three authoring situations requested for the guide:

- A long existing article kept all ordinary block markup while the divider was
  moved with the native Move up and Move down toolbar buttons. The remainder
  count changed from 7 to 8 and back to 7.
- A new article kept an ordinary paragraph after a configured divider. The
  divider remained self-closing and did not reparent the paragraph.
- A bounded Content lock section showed its end boundary and kept a public
  conclusion outside the section.

The review also covered a long selected Campaign name, missing Campaign repair,
the unsupported Custom HTML warning and its Find unsupported block action, the
420/320px narrow editor and visitor layouts, RTL, and the acknowledged visitor
reveal path. The missing Campaign warning is surfaced in the editor and exposed
through WordPress's polite accessibility region. Actual speech output still
needs a screen-reader check. The unsupported
warning selected the expected block after the action.

The isolated suite has 9 tests and runs with:

```sh
npx playwright test -c tools/visual-tests/content-lock-ux.config.mjs
```

It uses WordPress 6.8.3 on port 9423. The companion current/`latest`
WordPress authoring coverage also passed the divider insert/move/save/reload/
remove/undo journey at 420px, including a collapsed settings panel, with:

```sh
WCONVERT_VISUAL_WP=latest npm run test:visual:content-lock -- --grep 'writers insert'
```

That companion run is kept separate from the 9-test follow-up suite.
The current-WordPress author-refresh and empty-section scenarios also passed.
Local checks passed: 34 content-lock unit tests, TypeScript, ESLint and the block
build. The picker regressions cover Change, Cancel, Clear, selection and the
one-time request to focus settings, without moving focus on mount or refresh.

The configured editor screenshots were captured after fonts loaded and two
animation frames settled:

- [`content-lock-divider.png`](../guides/images/content-lock-divider.png)
- [`content-lock-section.png`](../guides/images/content-lock-section.png)

## Human exercise scripts

These checks still need an editor and a visitor using a real assistive setup:

1. In a long published article, place the divider between two paragraphs, move
   it one block up and down with the block toolbar, then publish and check that
   only the intended remainder is gated. Undo the move and confirm the text and
   formatting are unchanged.
2. In a new article, add an introduction, insert **Lock from here**, choose a
   published Content lock Campaign, add two ordinary blocks below it, save and
   open the published URL in a private window. Confirm both blocks are included.
3. In a Content lock section, put a bonus heading and paragraph inside the
   section and a conclusion after **Content lock ends**. Change, cancel and
   clear the Campaign with keyboard only, then restore the selection and confirm
   the conclusion remains public.
4. With a screen reader, verify the Campaign combobox label, the unavailable or
   missing Campaign warning, the unsupported-block warning and its jump action.
   On the visitor page, submit by keyboard and verify that the polite success
   announcement and **Continue to content** button are announced in order.
5. Repeat the editor and visitor checks at 200% browser zoom, 420px and 320px,
   in RTL, with a long Campaign name. Confirm there is no horizontal scrolling
   and that focus remains visible after Change, Cancel and Clear.

## Limits and findings

This run used Chromium through Playwright on a desktop host. It did not establish
behavior with a physical phone, a human editor, or an actual screen reader. The
mobile check used 320px/420px browser viewports; the scale-factor smoke check is
not a substitute for the browser's 200% zoom UI.

The complete isolated run finished with 9 passed tests in 1.8 minutes. The
canvas **Choose Campaign** action now opens the collapsed settings panel and
moves focus into the native Campaign combobox for both blocks, including the
closed-sidebar 420px case. The visitor check submits with the shadow form's
focused submit button, verifies the polite status node and keyboard-operable
Continue button, then verifies that explicit activation moves focus to the
revealed content. It does not require the status node to take focus, in keeping
with the documented rule against stealing focus from the page.
