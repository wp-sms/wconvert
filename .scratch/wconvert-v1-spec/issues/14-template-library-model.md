# Template library model

Type: grilling
Status: open
Blocked by: 01, 09

## Question

How are templates authored, stored, and rendered — and how many does v1 need?

The builder decision (curated gallery + constrained settings panel, no canvas)
puts unusual weight on templates: they are the entire design surface of the
product. If the library is thin or ugly, the product is thin or ugly, with no
canvas for users to escape into.

Open:

- **The authoring format.** HTML with a token syntax? A structured JSON layout
  tree? The choice determines who can author templates — a designer with HTML, or
  only a developer — and directly constrains whether a canvas builder can land
  later without a migration. That constraint was an explicit condition of the
  no-canvas decision, so it must be honoured here.
- **What the settings panel can change** versus what is fixed per template. Too
  little control feels restrictive; too much recreates a canvas badly and lets
  users break the design.
- **Storage and updating.** Bundled files, database rows, or both. What happens to
  an Optin when its underlying template is updated by a plugin release — this is
  the snapshot-versus-reference question again, and it should be answered
  consistently with *Goal to Playbook prefill semantics*.
- **Coverage.** How many templates per Goal and per display type make the gallery
  feel complete rather than sparse? Note this multiplies: four display types
  times five goals is a large matrix if every cell needs filling. Decide whether
  templates are goal-specific or goal-agnostic — that choice sets the whole
  production cost.
- **Theme inheritance.** Should templates inherit site fonts and colours, or stay
  fully self-contained? Depends on the isolation approach.
- Who produces them and in what format the design handoff arrives.

Blocked because the isolation prototype determines what markup and CSS a
template can legally use, and the storage model determines where they live.
