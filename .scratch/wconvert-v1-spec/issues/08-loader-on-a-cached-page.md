# Loader on a cached page

Type: prototype
Status: open

## Question

Does the chosen front-end delivery model actually hold up — under full-page
caching, and inside a 15KB budget?

This is the single biggest technical risk on the map. The delivery decision
(deferred loader + per-URL JSON in the page + client-side rule evaluation) was
chosen *because* server-rendered alternatives break under page caching. That
reasoning is sound but unproven, and every other front-end decision sits on top
of it.

Build a throwaway prototype that proves or breaks it:

- A minimal loader that reads a localized JSON payload, evaluates two or three
  rules, and shows a popup.
- Per-visitor state — already seen, dismissed, session count — in cookies and/or
  localStorage, evaluated entirely client-side.
- Run it behind a real page cache. WP Rocket, LiteSpeed, or even a plain
  `Cache-Control` proxy in front. Confirm two visitors on the same cached URL
  get correctly *different* behaviour.

What the prototype must answer:

- Actual gzipped size of a loader doing this honestly, and how much headroom the
  15KB budget leaves for the full v1 rule set. **If the budget is wrong, say so
  now** — better to move the number here than to discover it during the build.
- Whether the JSON payload is a meaningful page-weight cost on a site with many
  optins, and whether per-URL scoping is sufficient.
- Interaction with cache plugins that minify, combine, defer, or delay JS. Delayed
  JS in particular is common and could break exit intent outright.
- Whether exit intent is even viable at this budget, given it is the flagship
  premium rule.

Link the prototype from this ticket. Throwaway code — the output is the finding,
not the artefact.
