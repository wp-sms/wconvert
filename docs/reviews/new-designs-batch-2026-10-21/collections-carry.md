# Collections carried over the bar-chrome renderer change

This branch adds two rules for a bar's close control to the shared renderer
(`resources/renderer/src/css.ts`, `mount.ts`). They apply only to
`.wc-close[data-bar]`, which no studio render contains.

`npm run templates:visual-diff -- --base origin/main --apply` rendered every
approved setup with both renderers and found all of them pixel-identical
(148 carry records, none listed for review). A Collection's revision hashes its
setups' revisions, so all nine Collections went stale with no change to their
items, order, words or rendered screens.

Each Collection is carried with its previous evidence. None of the seven new
setups in this batch was added to a Collection. Not a new review.
