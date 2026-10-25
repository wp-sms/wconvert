# 0173: The Free ZIP carries a core

Accepted 2026-10-25. Amends 0043 §1 and 0157.

## Context

The Free ZIP bundled 84 designs. Every site downloads all of them whether or
not it uses one, and wp.org reviewers read them. ADR 0157 made a home for Free
designs the catalogue alone serves (`tools/design-library/hosted/`), and the
gallery now installs an online card on Use (ADR 0171), so a design no longer
has to ship to be offered.

## Decision

**The Free ZIP keeps a core of 55 designs and the 82 setups that use them; 29
designs and their 36 setups moved to `hosted/`.** The list was reviewed and
approved design by design (claude.ai/artifact/1oFFNK2N783q99w7AAs6sm). A design
stays bundled when any of these holds:

1. **It is recommended** (`FlagshipCollection`): the twelve setups the gallery
   puts first.
2. **A bundled Collection names it.** `CollectionLibrary` reads only bundled
   folders, so a member moved online would silently drop out of its Collection.
3. **A test pins it**: the three cart setups (`BundledPlaybooksTest`), and
   `centred-card`, the baseline fixture of 31 test and verifier files.
4. **Its Goal would fall below two popups and two inline forms** among the
   designs still bundled, where it has that many today.
5. **The catalogue cannot serve it.** Three capture journeys (consent that does
   not start hidden) and nine designs with inline SVG art that has no reviewed
   raster derivative cannot be exported (ADR 0156), so moved they would reach
   nobody.

Everything else moved: `agenda-card`, `appointment-note`, `benefit-grid`, `bold-ask`, `citrus-sunrise`, `code-reveal`, `colour-atlas`, `cream-coupon`, `deadline-panel`, `flash-offer`, `ink-split`, `inline-bar`, `inline-quiet`, `inline-tinted`, `journey-enquiry`, `material-pair`, `photo-wash`, `preference-card`, `programme-board`, `project-notebook`, `project-workboard`, `recipe-clipping`, `resource-index`, `room-checklist`, `service-ledger`, `supper-menu`, `trail-window`, `weekend-broadsheet`, `wide-banner`.

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
