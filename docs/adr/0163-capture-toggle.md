# 0163: Add or remove the contact form without changing the design

Accepted 2026-10-22. Amends 0059, 0080, 0085 and 0099. Issue #322; the approved
prototype is <https://claude.ai/artifact/DJJhMNevHZbXfqMha2DiPs>.

Merchants pick a design for how it looks, then decide whether to show the offer
straight away or ask for an email or phone number first. Nothing let them make
that second choice: no edit added a main form, removing one was refused in five
places, the Goal refused it too, and changing the Goal reset Undo.

## 1. One engine, three ways in

A pure admin module (`builder/structure/captureConversion.ts`) converts a simple
design between **no form**, **email** and **phone**, and returns the new config,
the new Goal and a list of changes. The editor's Screens switch, ordinary edits
(dropping a contact field on a one-screen design, deleting the form screen or its
only field) and the gallery's "Use with email form" / "Use without form" all call
it and show the same short "what changes" box. One Undo reverts the design and
the Goal together.

- **Adding a form** turns the offer screen into the form screen. Its headline and
  artwork stay; a field, a visible consent and a submit button are added in the
  counted link's place. A thank-you screen cloned from the offer gets the code and
  the old link as a `followup` (§3). Only the one email or phone field is added.
- **Removing a form** keeps the form screen's words and artwork, moves the code
  and any `followup` onto it, and drops everything else the form owned: fields,
  consent, buttons, the thank-you screen, intro screens, optional signups,
  destinations and field mappings. Each is named in the box first. Saved Leads
  and consent records are untouched.
- **Email ↔ phone** swaps the field, the consent wording and, for list Goals, the
  Goal, and clears destinations for the old channel.

Quizzes, lead magnets, product blocks, content locks, cart Goals and branching
journeys are refused with one plain line. Designs the template sweep finds
cannot carry a form are marked `"form_switch": false`.

Form-owned text (field label, consent, submit, thank-you headline) uses defaults
when added and is listed when removed. Re-adding regenerates the defaults; only
Undo restores edits.

## 2. A message has no converting act: the **Show a message** Goal

Removing a form from a design with no link leaves nothing to count. That is a
legitimate campaign (free shipping, opening hours), so it gets a Goal of its own,
`show_message`, whose outcome action is `none`:

- `OutcomeContract::designIssue()` accepts exactly one content screen, no
  submissions and **no** act. It never calls `ConvertingAct::from('none')`.
- `CaptureJourney` accepts zero or one link on a one-screen design; which one a
  Goal wants is the outcome contract's call. Library registration
  (`TemplateLibrary`, `PackValidator`) still requires exactly one act, so no
  bundled design changes.
- `POST /optins` refuses a design offering nothing **unless** the requested Goal's
  action is `none`. A test arm offering nothing beside one counting a conversion
  is refused as not comparable.
- Reporting: the headline is Appearances, the rate is `null` ("Not counted"),
  Insights never says the rate fell, the beacon refuses a `conversion` for a
  tree offering no act, and Pro analytics sends no conversion event.
- Prefill, design search and agent-created drafts take the design's counted link
  out (`OutcomeContract::fitted()`), so a `show_message` Playbook names an
  existing click design. Two Playbooks start it: free shipping and opening hours.

The admin picks Goals by their outcome, never by id (`GoalParityTest`): `click`
with a link required and no cart, `none`, or `submit` with email/phone capture
and no destination type.

## 3. A counted link cannot live in a form design

`CaptureJourney` refuses a `link` button once there is a submission. So adding a
form turns the link `button` into a `followup` on the thank-you screen (ADR 0080),
and removing the form turns the `followup` back into the counted link `button`.
Without one, the box offers an optional **Add a Shop now button**, prefilled with
the shop page or the home page: ticked is `promote_offer`, unticked is
`show_message`.

## 4. The Goal travels in Undo; a locked Goal makes a copy

The server already saves the Goal and config in one PATCH. The client kept the
Goal out of Undo and reset history on a Goal change. The draft snapshot now
carries the Goal, so Undo and Redo restore both. **Change goal** keeps its
immediate save.

After first publication, and for A/B arms and test parents, the Goal stays fixed
(ADR 0085). The switch then reads **Make a signup copy** / **Make an offer copy**
and creates a new unpublished draft with the converted design, named with
"(signup)" or "(offer)". The original and its results are untouched.

## Consequences

- Any simple design works with or without a form. Templates are not re-authored;
  an automatic check plus a screenshot sweep covers every design.
- A thank-you screen's content and code still ship in the page before submission
  (`PublishedProjection`, `PayloadTag`). That is unchanged here and tracked as its
  own issue.
- No storage is added.
