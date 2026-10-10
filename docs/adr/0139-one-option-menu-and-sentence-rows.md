# 0139: One option menu, rules as sentences, and "is not"

Date: 2026-10-10. Status: accepted.
Amends [0005](0005-the-rule-model-is-three-flat-closed-axes.md) (a leaf may
carry `negate`), [0078](0078-editor-choices-stay-compact-and-scrollable.md)
(one list keyboard; Add element gains arrow keys),
[0104](0104-display-workspace-uses-bounded-groups-and-fresh-gestures.md) (the
groups and the limits' wording), [0129](0129-display-rules-plain-questions-and-quick-picks.md)
(the picker's sections and the row's shape) and [0131](0131-one-way-to-show-each-thing-in-the-admin.md)
decision 10 (a refusal's two lengths). GUIDELINES §7, §9, §14 and §15 carry the
rules. The approved mockup — claude.ai/artifact/1ZkYbAFnXEmNqArDNTWaBa, with
its copy table — was the review gate; it shipped as three pull requests.

Before this:

- **Dropdowns were built five ways** — 66 bare `<select>`s, `DropdownMenu`,
  hand-built popover lists, comboboxes and an unused Radix `Select` — and
  headings, two-line items and keyboard handling were rewritten in Add rule,
  Add element, the refusable block menu, the swap menu and the campaign row.
- **Hints and refusals ran long.** Every picker item had a line restating its
  name; a refused menu item wrapped a three-line sentence under a greyed row,
  and several disabled items said nothing at all.
- **A Display rules row was stacked**: name, a preset select, a help sentence
  and a labelled field. Every group read "Visitors who…"; all/any appeared only
  from two rules; the limits just hid the Add controls.
- **There was no "is not".** "Anywhere but mobile" was a preset for one case.

## Decisions

1. **One option menu for every rich list** (`components/ui/option-menu.tsx`):
   one set of parts — group, item, submenu, separator, empty state — in two
   modes the container picks. **List mode** is a searchable popover whose items
   are buttons and whose `useListNavigation` owns ArrowUp/Down, Home/End and
   ArrowUp back to search. **Menu mode** is Radix's `DropdownMenu`, which owns
   the keyboard and typeahead. Headings are sentence case and stick; a lock is a
   paid group, an amber plug a missing plugin, and a free install draws no
   locked group (ADR 0116).
2. **Tiny lists stay native.** `NativeSelect` is the one select, and inside a
   sentence it is drawn as a word: `word` ("Match [all ▾] of these") and `pill`
   ("is / is not", "Signed in / Signed out", "any of / all of / none of"). The
   hand-copied selects moved onto it; the Radix `Select` is deleted.
3. **A hint only where the name doesn't say it**, six words at most; the long
   help is ⓘ. Layout notes are five words (`TemplateLabels::layoutNotes()`) with
   the old sentence behind ⓘ (`layoutHelp()`).
4. **A refusal shows a short reason and keeps the sentence in ⓘ, and both are
   announced.** The item is `aria-disabled` and stays focusable; its
   description is the full sentence. In list mode ⓘ is an `InfoTip` beside the
   item; in menu mode a button inside a `menuitem` would be pressed as the item,
   so the item itself carries a tooltip. Every refusal is written in two lengths
   by the guard that decides it (`catalogue.ts`, `swap.ts`, `guards.ts`,
   `journey.ts`, the graph removal plans), never looked up afterwards.
5. **A rule row is a sentence of pills**: icon and name, "is / is not" where
   the type allows it, then the value. A preset rule's pill opens its presets
   with a check and Custom…, which keeps the row's values and draws the params
   under the list; a set, number or range opens its own control; a closed
   choice is a word; a rule with no params is its name. Help is ⓘ beside an ✕
   named for the row; status notes stay under it.
6. **Groups say how they combine**, even with one rule: "Group N · Match [all ▾]
   of these", rows joined by "and" or "or", a bold OR between groups, and
   "+ Add another group" opening the new group's picker. The limits are said in
   words where the Add controls were — "Up to 8 rules in a group", "Up to 5
   groups" — with ⓘ saying what to do instead. Opening reads "Opens when [any ▾]
   of these happen".
7. **Rule names are nouns**, so a row reads as a sentence: **Ad blocker**,
   **Cart** (has items / is empty), **Cart total**. Devices are Phone, Tablet
   and Computer everywhere; inside a sentence an option reads by its phrase ("a
   phone"). The picker's sections are Pages, Visitor, Traffic source, Cart,
   Timing and Actions — an explicit map with no catch-all.
8. **"is not" is a bounded leaf flag.** An audience leaf of a type the manifest
   marks `negatable` may carry `"negate": true` — device, role, time of day,
   referrer, URL parameter and the four cart totals. **It is not an operator and
   never applies to a group**, which is why ADR 0005's "no expression language"
   still holds: a negated leaf is still one closed type with scalar params, and
   the group around it is still ALL or ANY. A type with an opposite of its own —
   Sign-in status, Ad blocker, the "none of" cart sets — is not negatable, and
   no trigger is: "did not scroll" is not an event.

## How negation is read

- **One helper.** `leafAnswer(rule, raw, known)` in `loader/display-rules.ts`
  is the only place a negation is applied — by `decide`, the inspector and Test
  a visit. A consent block stays blocked; a rule with no module or one that
  throws is false and is not inverted; and an answer that is not `known` yet
  is false, so "Cart is empty" never shows before the cart has answered.
  `RuleEvaluator.known()` is optional; Pro's cart bridge implements it.
- **The server answers its own facts.** A negated `role` is inverted in
  `DisplayPlan::forRequest()` before the group's ALL/ANY short-circuits. Client
  leaves travel as stored; the browser applies the flag, never both.
- **Publish refuses contradictions.** A negated device takes its set away from
  what is left, and the same rule asked both ways in an ALL group is a
  contradiction; `groupProblems` mirrors both.
- **The words are PHP's.** `RuleLabels::negativePhrases()`,
  `negativePresetPhrases()` and `negation()` reach the builder as `not_phrase`
  on the type and each preset and `negation: {is, not}`. A negated rule is never
  a Quick pick.

## Consequences

- `resources/rules/manifest.json` carries `negatable` on every entry; the
  parity test requires it and allows true only on Condition and Visitor kinds.
- `config.display_rules` gains no column: `negate` is stored inside the
  existing JSON, only when true.
- The loader budget grew, approved by the user: +32 B for Pro (26,976 B) and
  Elite (27,648 B) for `leafAnswer` and the cart bridge's `known()`. Free
  fits unchanged (`bin/check-loader.mjs`).
- `User role` reads in the Who sentence ("their role is Editor"), so a Visitor
  fact on the Targeting axis may carry a phrase; a Page rule still may not.
