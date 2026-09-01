# Part 3 — the editor work (the brief this branch implements)

## Where things stand

`main` is at 2f3e540. PR #83 merged — Display Rules is now four sections (Where /
When / Who / How often) with plain-language summaries, and the eligibility
inspector runs on the real page at `?wconvert-inspect=1`. 1193 PHP + 908 JS tests
green; loader is 5934 B free / 6475 B pro gzipped.

Read `CLAUDE.md` and `CONTEXT.md` first. Read the ADRs that touch what you
change — and note ADR headlines are not their current state, so read the inline
"Amended by" notes. ADR 0048 is the newest and lists what it amends.

## The problem

The editor is four tabs (`design | content | rules | destinations`,
`OptinBuilder.tsx:150`). **Goal and Playbook live outside it** in a
non-re-enterable 3-step creation wizard, and **Publish lives on the Optin list**.
So a merchant editing a campaign cannot see what it is for, what it measures, or
whether it is live.

## Build, in this order

1. **The readiness panel** — Goal and its metric, the four rule sentences (free:
   `builder/rules/sentence.ts` already exports `whereSummary`, `whenSummary`,
   `whoSummary`, `howOftenSummary`), destination health, unresolved warnings,
   and draft/live state.
2. **Surface Goal and Playbook in the editor.** Read-only is fine; invisible is
   not.
3. **The three missing leaf controls** — `heading.level`, `image.fit`,
   `field.required` are declared in the template manifest, read by the renderer,
   and have no control anywhere.
4. **`destination_hint`** is written by Playbook prefill and read by nothing.

Not the eight-stage lifecycle rail. The research's own argument is that the rail
is useful *because of* the summary beside it — build the summary.

## Things that cost this project real time last round

**The CSS specificity trap, twice.** The admin has three blanket rules:
`.wconvert-editor :is(h2, h3, h4)` (size), `.wconvert-editor :is(p, h2, h3, h4,
table, ul, ol)` (margin), and `#wconvert-admin :is(p, li, td, th, label, legend,
select, input, textarea) { font-size: inherit }`. A bare `.wconvert-thing { … }`
is (0,1,0) and **loses to all three while looking exactly like it works**.

- State a type role as a **Tailwind utility in the TSX** (`text-micro uppercase
  text-muted-foreground` — see `shell/Stat.tsx`), never as `font-size` in
  `index.css`. Utilities are `!important` (ADR 0035).
- Prefix component **margin/padding** rules with `#wconvert-admin`.

A layout fault here is invisible to a green suite. Boot the Playground one-liner in
`README.md` with `--php=8.1`, drive it with Playwright headless (the Chrome
extension reports `visibilityState: hidden`, which makes timing read as stuck),
**take screenshots and read them**, and measure the box model — not just font
sizes. Four separate layout bugs shipped past a green suite last round because I
measured type and never measured a margin.

**No animations, shadows or gradients.** The palette and type scale are
ADR 0037's; green and amber are reserved for meaning (see the Optin list's
badges). ADR 0039 now also names the density rule: a fact identical for every
item in a group belongs to the group, and a classification is a badge, not a row.

## Process

Work on a branch, open a PR, never push to `main`. Run
`/mattpocock-skills:code-review` against `main` **before** asking for review.

Verification gate: `composer test && composer phpstan && npm test && npm run
typecheck && npm run lint && npm run check:loader && bash
bin/verify-source-contract.sh`, plus a real-WordPress pass.
`tests/unit/Database/SchemaTest.php` must pass untouched — adding a table or
column needs explicit sign-off first.
