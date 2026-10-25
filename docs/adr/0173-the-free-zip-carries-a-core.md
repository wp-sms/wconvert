# 0173: The Free ZIP carries a core

Accepted 2026-10-25. Amends 0043 §1; completes 0157.

## Context

The Free ZIP bundled 84 designs. Every site downloads all of them whether or
not it uses one, and wp.org reviewers read them. ADR 0157 made a home for Free
designs the catalogue alone serves (`tools/design-library/hosted/`), and the
gallery now installs an online card on Use (ADR 0171), so a design no longer
has to ship to be offered.

## Decision

**A Free design leaves the ZIP only when the catalogue serves it and nothing
bundled needs it.** This first cut moves 13 designs and their 16 setups to
`hosted/`; the ZIP keeps 71 designs and 102 setups. A design stays bundled when
any of these holds:

1. **It is recommended** (`FlagshipCollection`): the twelve setups the gallery
   puts first.
2. **A bundled Collection names it.** `CollectionLibrary` reads only bundled
   folders, so a member moved online would silently drop out of its Collection.
3. **A test pins it in the ZIP**: the three cart setups
   (`BundledPlaybooksTest`), and `centred-card`, the baseline fixture of 31
   test and verifier files that read the bundled library. A test that only
   reads a design's JSON reads it from either folder
   (`tests/js/support/designs.ts`).
4. **Its Goal would fall below two popups and two inline forms** among the
   designs still bundled, where it has that many today.
5. **The catalogue does not serve it**, so moved it would reach nobody:
   - 13 cannot be exported (ADR 0156): three capture journeys whose consent
     does not start hidden, and ten designs with inline SVG art that has no
     reviewed raster derivative;
   - 16 are not published: the design, or one of its setups, has no current
     approval (ADR 0162), and a bundled setup must not name a hosted design
     (ADR 0157).

The list proposed on the review page (claude.ai/artifact/1oFFNK2N783q99w7AAs6sm)
applied rules 1–4 and was approved as 41 kept; rule 3's `centred-card` and
rule 5 were found while building and keep 30 more. A design held by rule 5
moves in a later change, once its art or consent is reviewed for the catalogue
or its setups are approved; nothing else needs to change.

Everything else moved: `agenda-card`, `citrus-sunrise`, `colour-atlas`,
`material-pair`, `programme-board`, `project-workboard`, `recipe-clipping`,
`resource-index`, `room-checklist`, `service-ledger`, `supper-menu`,
`trail-window`, `weekend-broadsheet`.

A moved design keeps its id and revision; a moved setup keeps its id. Their
photos are written back into the design as data URIs, since a hosted design is
outside both ZIPs and the exporter splits its pictures itself (ADR 0172 §5).

## Consequences

- A site that allows the library sees the moved designs as online cards
  (`install`) instead of `ready` ones; Use installs, then opens the draft.
- A site offline, or one that declined the library, still has the core: every
  Free Goal keeps two popups and two inline forms, or every one it had where it
  had fewer (Show a message has two inline forms and never had a popup).
- A design a site installed before keeps its installed copy (uploads cache),
  and a campaign keeps its own snapshot and Media Library photos.
- **This ships only after a catalogue release containing the moved designs is
  live** (`verify:remote` passes); before that, a site would lose them.
