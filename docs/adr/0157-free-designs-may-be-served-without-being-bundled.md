# 0157: Free designs may be served without being bundled

Date: 2026-10-20. Status: accepted.

Amends [0156](0156-the-catalogue-is-one-design-per-object.md) §5.

## Context

Until now a design was authored in one of two places, and the place decided
the ZIP: `resources/templates/library/` ships in Free, `pro/modules/*/templates/`
in Pro. The catalogue (0156) already serves Free designs as their own objects,
and a Free site already shows one it does not bundle as `install`, then
`ready` (0156 §1, §6). What was missing was somewhere to author such a design.

The Free ZIP is read by wp.org reviewers and downloaded by every site, so each
bundled design costs every site its bytes whether or not it is ever used.
*(Completed by [ADR 0173](0173-the-free-zip-carries-a-core.md): 13 of the
Free ZIP's 84 designs moved to `hosted/templates/`; the ZIP keeps the 71 a
site needs offline or the catalogue cannot yet serve.)*

## Decision

**A third source, `tools/design-library/hosted/templates/`, holds Free designs
the catalogue alone serves.** `/tools` is in `.distignore`, so nothing there
reaches either ZIP. A hosted design must declare `tier: free`; Pro designs keep
their module folders.

**One registry names every source.** `tools/design-library/build/sources.mjs`
lists the folders and what delivers each (`free`, `pro`, `hosted`). Every
review and publishing tool reads it instead of keeping its own list. The PHP
exporter, the pilot and `bin/verify-templates.php` add the same folder. One id
authored in two folders is refused, so copying a hosted design into a bundled
folder fails instead of shipping it twice.

**Hosted setups live beside them.** `tools/design-library/hosted/playbooks/`
holds the Playbooks for hosted designs, read by the same three tools
(`build/sources.mjs` `setupSource()`). A bundled Playbook must not name a
hosted design: the ZIP carrying the Playbook would lack its design.
`HostedPlaybooksTest` registers each hosted Playbook against the designs a
Free site can hold, and on the disposable review site
`tools/visual-tests/mu/hosted.php` composes both folders into the libraries as
an installed catalogue setup would be.

**A hosted design is numbered, exported and reviewed like a bundled one.** It
has a revision in `publishing/revisions.json`, a history record, a rights
record for each image, catalogue words, and the same near-duplicate, contrast,
copy, literal-colour and per-design byte checks. The byte budget measures it
as installed, with each picture bound to a local URL (`PackImages::hydrate`).
It is listed in **neither** bundled `revisions.json`, because neither ZIP
carries it.
*Amended by [0162](0162-the-delivery-plan-is-derived.md):* it is published
once one of its setups has a current approval; no plan list names it.

**Collections may also be catalogue-only (22 October 2026).** A curated source
with `catalogue_only: true` follows the same review and hosted publication path,
but generates neither a bundled JSON snapshot nor a bundled translation label.
This lets a seasonal collection include hosted Free and Pro setups together
without putting Pro references into the Free ZIP. The flag is authoring metadata;
the server still exports the existing collection schema. Previously approved
online collections with stale dependencies are refused, just as stale bundled
collections are. The Black Friday & Cyber Monday collection uses this delivery.
Its discovery response includes all published members and public previews before
installation, plus each member's availability and usable local Playbook identity.
It does not expose Pro source trees. Free/Pro labels and separate Install/Use
actions follow [0156 §9](0156-the-catalogue-is-one-design-per-object.md).
Installing a member changes its action, never the collection's membership.

## Consequences

- Free can grow its gallery without growing the ZIP. A Free site sees these
  designs only through the catalogue, so they are not available offline or when
  the catalogue cannot be reached.
- The Free ZIP's root allowlist in `bin/verify-artifact-contract.sh` already
  fails an artifact that carries `tools/`; a test now pins that for the hosted
  folder.
- A hosted design is still authored and reviewed in this repository; the
  template server only publishes what the release build exported.
