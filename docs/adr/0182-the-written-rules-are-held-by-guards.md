# 0182: The written rules are held by guards

Accepted 2026-11-02. Amends sections of `tools/design-system/GUIDELINES.md` and
ADRs 0039, 0060, 0069, 0091, 0131, 0132, 0137, 0138, 0143, 0163 and 0171, each with
its own inline note.

## Context

ADR 0131 audited the admin against its guidelines and fixed what it found. By
November the same departures were back: a read-only pass over the reading
screens, the builder, Pro and the blocks confirmed about 150, and a rendered
pass confirmed the ones that could only be measured (a raw select in a portaled
dialog at 40px beside a 36px input, the License page's 24px card headings and a
search box whose text sat under its icon).

Most shared components were sound. Call sites went around them, because nothing
refused it: `eslint.config.js` had no restriction of this kind, and the words and
stylesheet tests skipped most of Pro. A rule that only lives in prose is kept
until the next person who has not read it.

## Decision

1. **Every fixable departure is fixed in one change**, one commit per family:
   loading and failure, refusal and busy, controls, dialogs, the License page,
   one answer per situation, then data, words, direction and type.

2. **The rules are guarded, and the guards read Pro.**
   - ESLint refuses a raw `<select>`, `<textarea>`, `<details>` or checkbox,
     `<Button size="sm">` and a physical popover `side`. The components that
     own those shapes are exempt.
   - `tests/js/admin-guidelines.test.ts` holds what is about a word or a
     string: `Intl` outside `lib/format.ts`, a hand-rolled error message, `%d`
     in a translated string, a Tailwind size outside the roles, a retry word
     other than "Try again", a literal tier name, each `aria-pressed`, a
     literal colour and a shadow.
   - `flow-words.test.ts` and `admin-stylesheet.test.ts` now read Pro and the
     block sheets.

3. **The allowlist is exact.** `tests/js/admin-guidelines-allow.json` states how
   many of each a file holds, and a fixed one has to leave the list, so it never
   allows what has been fixed. What is on it now is what was decided:
   - `retry`: `JourneyTest.tsx`'s "Retry products", which repeats the visitor's own
     wording in a simulation of what a visitor sees, and the note explaining it.
   - `pressed`: each one read and an independent toggle.
   - `colours`: the two block sheets, because the block editor does not load the
     admin's tokens. They share one palette instead.
   - `shadows`: `stage.css`'s phone on the ghost page. A ring or inset rail with
     no blur is a line rather than a shadow, and the rule allows that shape.

4. **Recorded exceptions, kept rather than churned.** Each explained itself in a
   comment and cited nothing, so each is now in the guidelines.
   - The page picker prints its ID, because two pages can share a title. It is
     the third exception to "no ID on any screen" (§8, §18, ADR 0131).
   - "Working" rather than §14's "Delivering": the badge answers the merchant's
     question, and the record is the "Last sent" line beside it.
   - Sending issues has a Refresh (§13): a queued send retries in the background,
     so that view can change while it is open. Every other Destinations action
     re-reads on its own.
   - The destination card draws its own header in `RegionHeader`'s slot, because
     its description carries a link (§6).
   - Font rows stay in a popover (ADRs 0042 and 0054), unlike the option menu,
     because each is set in its own face.
   - Leads applies its search on Enter. Each apply is a server query, and a
     half-typed address parses as a different filter from a whole one. Its anatomy
     matches the others (§11).
   - Spam protection's "No activity yet." stays a line in a readout, not an
     `EmptyState` (§11).
   - An arrow inside a translated sentence, such as a menu path, stays text, because
     only a translator can place it. An arrow beside a value is `Arrow` (§15).
   - Timezone arithmetic and zone names use `Intl` directly (`lib/wallTime.ts`,
     `leads/calendar.ts`, `discovery/model.ts`), because `format.ts`'s helpers take
     no named timezone.

5. **The License page is drawn with shared regions** (amending ADR 0143
   decision 8). Its structure and words stay; its own cards, notice and 24px
   headings go, so it reads as the same product as Settings.

6. **Dialog decisions the audit forced** (§9).
   - The read-only exit is **Done**, at the start. ✕ keeps the word Close.
   - A view opened in place steps back on Escape, one view at a time. ✕ and an
     outside click still leave the modal.
   - The template gallery's inspection and What changes open in place with Back.
   - A title is the subject, except where the dialog's subject is the action and
     nothing exists yet: Change template, Change goal, Add a destination.
   - `AddDestinationPicker` stays Medium, because a short list's rows would run 80rem.
   - "Whose content" is one shape and one set of words, "Keep my current content"
     (amending ADRs 0069 and 0137).

## Consequences

- A new departure fails on the pull request rather than waiting for an audit.
- Source guards prove a call site uses the shared thing and nothing about how
  it renders. The rendered checks still own that (§21), and neither replaces
  looking at the screen.
- `%s` plus `formatCount()` is now the only way to print a count, so a
  translator sees `%s` where they saw `%d`. The translator comments say what it
  stands for.
- Admin visual expectations moved with the type and height changes.

## Not done

- Other dead CSS found on the way (a pane family, `wconvert-pack*`, `contrast__*`,
  `readiness__*`) is unused and harmless, and was left out to keep this reviewable.
- "Cart" stays where the server owns the name or a metric carries it (rule
  catalogue, the recovery Goal's copy, "Add to cart", "Cart return clicks"). Admin
  sentences say "basket" (ADR 0120, `CONTEXT.md`).
