# 0131: One way to show each thing in the admin

Date: 2026-10-09. Status: accepted.
Amends [0060](0060-a-screen-is-four-situations-and-they-are-answered-the-same-way.md)'s
retry, loading and Milestones rows, and
[0066](0066-the-editors-chrome-is-one-card-with-three-named-panes.md)'s `label`
and `meta` roles. GUIDELINES §§3, 4, 7, 8, 9, 12, 13, 18, 20 and 21 carry the
rules.

An audit of every admin screen, modal, popover and confirm (about 110 files)
found the system intact and its application drifted:

- **Modals.** Only the template pickers and the transfer dialog followed the
  layout agreed in 15e8c6b. About twenty-five dialogs had grown their own.
- **Data.** Screens printed raw timestamps, ULIDs, field keys and WooCommerce
  status slugs.
- **Copy.** Padded, and naming the same thing several ways.
- **States.** Loading, failure and empty were drawn seven ways.
- **Controls.** One shared checkbox rule at (1,2,1) with `font-size
  !important` silently erased more than fifteen component rules, including the
  campaign filters fixed twice before (9e4e542, ad89c80) and the Dashboard's
  comparison switch, which rendered as a plain checkbox with no thumb.

## Decisions

1. **One modal layout, three sizes** — `components/ui/admin-dialog`. Small
   32rem (confirms, short forms), Medium 48rem (details), Large 80rem
   (pickers, journey, preview). The header's title is the subject itself, with
   an optional badge and one meta line; the body is the only scroll; the footer
   is fixed with Back or Cancel at the start, a note, the primary action at the
   end and an error beside it. The pickers' `PickerDialog*` are now thin
   aliases of it.
2. **Dirty dialogs ask once.** `AdminDialogContent dirty` makes Escape, an
   outside click and ✕ ask "Discard changes?" — drawn inside the dialog, over
   its footer — only when something was typed. It replaces the Targets
   editor's `onPointerDownOutside` block. A dialog never stacks another.
3. **Save feedback is "Saved just now" beside Save** — `shell/SaveStatus` —
   cleared on the next edit. No toast, no "…saved." line, no permanent "No
   unsaved changes". Every settings section has an explicit Save.
4. **No IDs on screen.** A missing name reads "Deleted campaign", "Removed
   destination" or "Unnamed". Search still accepts a pasted ID. **Exception:**
   campaign Details has a closed "For developers" disclosure with the campaign
   ID and Copy, because the free page events (`resources/loader/src/events.ts`)
   identify a campaign by that ID and nothing else; removing it would leave a
   developer no way to find it.
   *Amended by [0132](0132-every-screen-answers-its-first-question.md) (2026-10-09, block editor review): there is a **second** necessary
   exception — the inline campaign's **shortcode**, `[wconvert_optin
   id="…"]`, shown with Copy by the "WConvert campaign" block once a campaign
   is chosen and by the builder's manual placement (`ManualPlacement`), and
   likewise the content lock's enclosing `[wconvert_content_lock id="…"]`. The
   shortcode is how a campaign is placed outside the block editor (classic
   editor, page builders, widgets, theme files), and it can name a campaign by
   nothing but its ID. Everything else in the block editor still names a
   campaign by its name; an unnamed one reads "Unnamed campaign" and one that
   no longer resolves reads "This campaign", never its ID.*
5. **Naming.** A **lead** is the person a row is about; a **submission** is one
   form fill (one [[Lead]] record — the domain term is unchanged, see
   `CONTEXT.md`). "Email or phone", not "identifier". **Send** and **send
   again**, not push and re-push. **Shown** is the one name for impressions.
   **Keep in WConvert only** is the one name for local mode. Editor tabs are
   ~~**Screens · Design · Display rules · Destinations**~~ **Edit · Display
   rules · Destinations** (*amended by
   [0134](0134-one-edit-tab-look-screen-element.md)*), and a journey link to
   another screen is ~~the **next screen**~~ a **path**; the screen panel says
   where it goes as **Then →**. Domain nouns are lowercase
   mid-sentence. US spelling.
6. **Data has one format each** — `lib/format.ts`: dates in the site's locale
   and timezone ("Today, 2:22 PM" / "Yesterday" / "Oct 3" in lists, "Oct 9,
   2026, 2:22 PM" in details), counts and rates in the site's digits, money in
   the store's currency, stored keys through `labelOf()`.
7. **The canonical checkbox and radio row.** An 18px native input inside its
   `<label>`, centred on the first line, 8px from the text, the hint under the
   text. The shared rule's scope is `:where()`d so any component class beats
   it; the Radix `Checkbox` is retired; coarse pointers give checkbox rows the
   radios' 44px floor. One radio card (`.wconvert-radio-card`) serves every
   choice that needs a sentence.
8. **One collapsible** — `shell/Disclosure`, `card` or `inline`: whole-row
   trigger, trailing 16px chevron, body aligned with the title text. It
   replaces eight treatments. *Amended by [ADR 0136](0136-one-panel-grammar.md): in an editor panel a
   disclosure's title is at most three words and its summary says its value ("Consent · Shown").*
9. **Small type is a hierarchy, not a floor to raise.** `meta` (9) and `label`
   (11) stay as builder furniture. They never carry a control, a condition or a
   reason; those move to `micro` or `note`. *Amended by [ADR 0136](0136-one-panel-grammar.md): a builder field's
   one line of help is a `hint`, 12/400 muted; its label is `note` at 500.*
10. **Decided by existing rules, now applied everywhere:** red only for delete
    and remove (`ConfirmDialog` is `default` unless a caller opts in);
    destructive confirms are `AlertDialog`s that say what survives; more than
    two row actions go in a ⋯ menu; a refusal is `aria-disabled` with its
    reason; tier names come from `tierName()`; "Try again" is the one retry
    word; a region loads with a named skeleton, never a spinner.

## Consequences

- Milestones' admin component was dead code (nothing rendered it) and is
  deleted; ADR 0060's Milestones row is struck.
- Removing the IDs removes the only place a developer could read a campaign ID
  in Free; decision 4's exception is that place, deliberately closed by
  default.
- A dialog that needs a nested view (a lead's group history → one submission)
  opens it in place with Back rather than over itself.
- Data & privacy's fifteen paragraphs became a table — what is stored, why,
  how long — with the fine print in a closed disclosure. ADRs 0091 and 0094
  are amended inline.
