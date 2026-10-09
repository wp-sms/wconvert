# Manage screens exploration

Throwaway UI prototype, 2026-09-24. These files are not production feature code or
the final template schema. Nothing is saved, published, sent to a provider, or read
from WooCommerce. Refreshing the page resets all edits and visitor answers.

## Run

From the repository root:

```sh
npm run prototype:journeys
```

Open <http://127.0.0.1:5188/?prototype=journeys&variant=B&scenario=garden>.
The existing editor prototype remains available at `/` without `prototype=journeys`.

**B is the selected direction**, confirmed by the user after reviewing A/B/C.
The losing layouts and layout switcher have been removed. Existing variant URLs
normalize to B; the example still lives in the URL. Drafts remain in memory.
**Prototype data** shows the editable fixture. **Test journey → Inspect prototype
state** shows visitor answers, skipped screens, the local lead, and local counters.

## Selected layout and refinements

B retains visual screen cards and gives rules/results a dedicated settings pane.
The refinements address its original weaknesses without adding another editor:

- More compact thumbnails and a screen-count header in the left rail.
- Independent scrolling, selected-card visibility, and a persistent selected-screen heading.
- Stable screen selection through result-access changes and undo. New questions are
  inserted after the selected screen when possible, before capture/results otherwise.
- Screen actions in a labeled menu, with Edit design always available below settings.
- Clickable Used by links from a source question to its dependent screens/results.
- Edit condition links in the visitor path preview.
- At narrow widths, a labeled screen selector replaces the rail and settings use the full width.
- Result variants use the available panel width and retain explicit priority/fallback.
- Initial modal focus is on the title rather than the example selector.

The choice is confirmed; production accessibility and merchant usability are still
release checks. This revision does not promote throwaway code into production.

## Example walkthroughs

| Example | Try | Expected behavior |
| --- | --- | --- |
| Garden consultation | Choose garden, answer its size, go Back and switch to balcony | Garden size disappears and its previous answer is removed; contact details are still required |
| Find your coffee | Espresso + rich; then filter; then French press | Different result rules, a conditional grinder question, and an explicit fallback |
| Coffee without signup | Finish the quiz and view products; open signup and choose No thanks | One quiz completion and no lead; result remains available |
| Coffee with signup | Submit the optional email signup | One lead with the active answers; no second primary conversion |
| Coffee with a gate | Select Your coffee match in Manage screens; change Result access to Require email | Capture moves before results, the goal consequence is explained, and the first question discloses the gate; marketing consent remains optional |
| Coffee availability | In Test journey, change Simulate product availability | Unavailable products, API failure, and WooCommerce removal show a useful fallback; Try again restores the sample catalog |
| Choose your next guide | Select photography and growing plants | Both relevant follow-ups appear; the first matching result wins. Reorder result rules to compare priority |
| Email + optional SMS | Submit email, skip SMS; or explicitly submit both | The existing simple journey needs no rules; additional capture belongs to the same local lead |
| Editing dependencies | Try deleting Your project, or moving Garden size before it | A repair explanation prevents broken dependencies; labels can change without breaking stable IDs |

Question text, answer type, choices, and required status live in **Edit design**. Screen visibility and result priority live in **Manage screens**. Adding,
duplicating, moving, deleting, changing conditions, and undo are interactive.

## What is reused, and what is simulated

Reused from the actual admin: `JourneyScreenCard`, `Preview`, Radix dialog, buttons,
inputs, menus, Tailwind tokens, fonts, and existing editor styles. Screen thumbnails
and the canvas use the real template renderer. The surrounding editor is a reduced
host, not the complete WordPress campaign editor.

The visitor runner is a separate throwaway React rendering of proposed question
and result controls. Current renderer previews approximate new questions with text;
the new question/product nodes do not exist in production yet. Production must use
one renderer/evaluator path for preview and real visitors, rather than retaining
this runner as a parallel implementation.

The fixture JSON is intentionally simplified: one question per screen, local sample
products, local conversion flags, and no real submission contracts. It demonstrates
behavior and boundaries, not publish validation, real goals/history, arbitrary
question grouping, catalog search, real analytics, or accessible production readiness.

Example product IDs 101–103 are fake fixture IDs. Starter templates must never ship
these as merchant product selections. No answers appear in URLs or localStorage.

## Validation performed

- Vite prototype build succeeded.
- Browser walkthroughs exercised required answers, branch changes and answer clearing,
  two matching follow-ups, result priority/fallback, anonymous completion, optional
  signup/skip, gated results without marketing consent, and email with skipped SMS.
- Browser checks found no page errors or WordPress API requests in those journeys.
- The original exploration inspected all three layouts. The selected B revision
  checks desktop results/settings, narrow layout, dependency navigation, screen
  actions/undo, preview-to-condition navigation, and product failure simulation.
- Verified B route normalization, initial heading focus, Escape, 320/390/640/768 px
  layouts, stable selection through gate/undo, and contextual insertion.

These are one-off prototype checks, not a new maintained test suite. Production
requires the WordPress/WooCommerce, server validation, tier, performance, accessibility,
and privacy checks listed in the implementation plan.

## Disposition

Keep for UX review; rebuild the chosen behavior in production modules. Do not copy
the mock lead handling, alternate visitor runner, sample product catalog, or compact
fixture schema into the shipping plugin. Preview currently restarts when reopened;
production should preserve an unchanged test and clearly reset after relevant draft edits. The prototype is under `tools/`, excluded
from release archives. A and C and their development switcher have been removed.

The system recommendation is in
[`docs/plans/questions-system-design.md`](../../../../docs/plans/questions-system-design.md).
