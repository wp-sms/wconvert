# Admin components are vendored from upstream, not from WSMS

The admin's UI primitives — button, dialog, tabs, select, popover, table — are
vendored into `resources/admin/src/components/ui/` with shadcn's CLI, from
shadcn's upstream. They are **not copied from WSMS**, which has thirty of them
already written and working.

They are also not hand-written. Radix supplies the behaviour; shadcn supplies the
markup and the token bindings; WConvert owns the files from the moment they land.

## "No code is shared" was written about a different kind of code

CLAUDE.md's rule reads: WSMS *"is the **convention source** … and the
**integration target** — but no code is shared and neither release cycle
constrains the other."*

Read literally, copying `button.tsx` across breaks it. Read for what it protects,
it does not — and the difference is worth stating, because the literal reading
would push WConvert into hand-writing thirty primitives and the rule would have
cost weeks to protect nothing.

What the rule protects is **independence**: WConvert must not need WSMS to build,
to ship or to work ([ADR 0028](0028-the-free-loader-source-carries-no-premium-code.md)
and [ADR 0030](0030-free-and-pro-release-on-independent-tags.md) are the same
instinct applied to Pro), and a bug fixed in one must not have to be fixed in the
other on someone else's schedule. Shared *runtime* code creates that coupling.
Shared *domain* code creates it worse, because the two products model different
things and a shared `Contact` would eventually mean one of them is wrong.

**So the rule is re-scoped, in this ADR and by this decision, to mean no runtime
and no domain code.** Vendored UI boilerplate is neither.

## Vendoring from upstream is not a loophole — it is the shorter path

The temptation is to read "vendor from upstream instead of from WSMS" as
technique-lawyering: the same files arrive either way. They do not, quite, and
the differences all point the same direction.

- **WSMS's copies carry WSMS's decisions.** Its `button.tsx` has been edited for
  its own palette, its RTL handling, its `--shadow-brutalist`, and whatever else
  eleven months of product work put there. Taking it means taking those and then
  discovering them one at a time.
- **Upstream has an update path.** `npx shadcn add` against a component that
  moved upstream is a diff a maintainer can read. There is no such path from a
  sibling's working tree.
- **It is where WSMS got them.** Both products vendoring the same upstream
  produces the family resemblance the sibling relationship wants, without either
  tree depending on the other's. That is the whole of what
  [ADR 0037](0037-the-admin-inherits-token-structure-and-owns-its-values.md)
  formalises on the token side.

## Hand-writing against Radix was refused on timing, and that is honest

The alternative worth taking seriously is skipping shadcn and writing the markup
directly over Radix primitives. It gives the most control and the least inherited
opinion, and if this work were not on the release path it might win.

It is refused because it is weeks of primitives before a single screen is styled,
and this is release-blocking work. That is a scheduling reason rather than a
design one, and it is recorded as such so a future reader does not mistake it for
a claim that shadcn is better. **If the vendored components turn out to fight the
design, the escalation is to edit them** — they are WConvert's files, in
WConvert's tree, with no upstream to fight.

## The sidebar is where following the convention source stops

WSMS's admin is a left rail of sections. WConvert's is four tabs.

*Qualified by [ADR 0039](0039-a-screen-is-regions-and-scope-decides-placement.md)'s
"Levels are not a cap": this sentence is about **top-level sections** and about
the scale a rail exists to serve. It is not a budget on tabs anywhere else in the
product — the builder has its own tab strip a level below, and its count has
already moved once (five to four) without touching this decision. Recorded here
because the cheapest place to lose that distinction is a review comment reading
"ADR 0036 says four".*

That is not disagreement about taste. WSMS has twenty-five sections and WConvert
has four, and a rail exists to make twenty-five navigable. Copying it here would
be copying a response to a scale WConvert does not have — which is the failure
mode a "convention source" invites and the reason each convention is worth
checking against the thing it solved.

## Consequences

- **Three dependencies land in the admin bundle**: `tailwindcss`, `radix-ui` and
  `lucide-react`, plus `clsx`, `tailwind-merge` and `class-variance-authority` as
  shadcn requires. None reaches the loader, whose budget is untouched and whose
  source imports nothing from `resources/admin/`
  ([ADR 0029](0029-the-free-contract-is-proven-at-the-source.md) proves the
  direction that matters at every pull request).
- **`components/ui/` is vendored, not a dependency**, so it is read and reviewed
  like the rest of the tree and shows up in `bin/verify-source-contract.sh`'s
  scan like any other file under `resources/`.
- **Layers animate in and dismiss immediately.** Radix keeps content mounted
  while a CSS exit animation runs. Once dismissal has moved focus and revealed
  the underlying screen, that delay paints a shrinking translucent copy of
  stale UI over the control the merchant just reached; modal layers also retain
  their body scroll lock for the stale frame. Dialogs, alert dialogs, menus,
  popovers and selects therefore keep their upstream entry animation and remove
  every `data-[state=closed]` animation at the vendored primitive, never at a
  call site. `tests/js/admin-overlay-motion.test.ts` guards the complete set.
- **Icons come from lucide**, not dashicons — dashicons is WordPress chrome, and
  [ADR 0035](0035-the-admin-owns-its-page.md) stopped rendering that. The one
  dashicon that stays is the menu icon in WordPress's own sidebar, which is
  WordPress's surface and not ours.
- **The bundle grows, and is reported rather than gated**
  ([ADR 0038](0038-the-admin-holds-different-floors-to-the-loader.md)).
- **A component WSMS improves does not improve here.** That is the cost of
  independence and it is the intended one — the alternative is a shared library
  whose release cycle constrains both, which the rule this ADR re-scoped exists
  to prevent.
