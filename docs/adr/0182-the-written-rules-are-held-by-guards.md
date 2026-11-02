# 0182: The written rules are held by guards

Accepted 2026-11-02. Amends the sections of `tools/design-system/GUIDELINES.md`
and the ADRs named inline in the commits below; each carries its own note.

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
   - `retry`: `JourneyTest.tsx`, which repeats the visitor's own "Retry products"
     wording in a simulation of what a visitor sees.
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
   - Font rows stay in a popover (ADRs 0042 and 0054), unlike the option menu.

5. **The License page is drawn with shared regions** (amending ADR 0143
   decision 8). Its structure and words stay; its own cards, notice and 24px
   headings go, so it reads as the same product as Settings.

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
- "Cart" stays where the server owns the name (rule catalogue, the recovery
  Goal's copy, "Add to cart"). Admin sentences say "basket" (ADR 0120, `CONTEXT.md`).
