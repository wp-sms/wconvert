# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists — it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (most repos):

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

Multi-context repo (presence of `CONTEXT-MAP.md` at the root):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← context-specific decisions
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders) — but worth reopening because…_

A genuine **contradiction** — two sources that cannot both be true — is not yours to resolve. Report it and stop. A **missing marker**, where a later decision already settled the question and only the cross-reference is absent, is the section below.

## Record amendments in the ADR, not only on the map

A decision that amends, corrects, completes or supersedes an existing ADR must edit that ADR file **in the same commit that records the decision**. Writing it only in the ticket resolution or the map's index is how an ADR read in isolation hands a future session a decision that was already overturned.

This is not hypothetical here. Every ticket dutifully amended `CONTEXT.md` inline and the glossary never drifted; no equivalent rule covered `docs/adr/`, and twelve of thirty-two ADRs went stale — one of them still describing a template shape a later ticket had corrected.

**House style is an inline note where the superseded claim sits** — not a status header, not a changelog at the bottom. Put the correction against the wrong sentence, so a reader who only reaches that paragraph still gets it:

> _Amended by [ADR 0028](0028-the-free-loader-source-carries-no-premium-code.md): this originally read "one loader source, tree-shaken on a mode flag". It is **separate module trees** instead — premium rule modules live under Pro's, and Pro's entry imports free's plus its own._

Note what that example does: it says what the ADR **originally** claimed, what replaced it, and why. A bare "see ADR 0028" makes the reader go and diff two documents.

**Both directions, every time.** The amending ADR names what it amends; the amended ADR names what amends it. The standard convention is to update one side and forget the other, so treat the second edit as part of the first.
