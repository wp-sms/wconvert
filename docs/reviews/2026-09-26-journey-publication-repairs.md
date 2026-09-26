# Journey publication repair audit

September 26, 2026. This is a scoped audit, not a claim that every server
refusal has a dedicated repair control. PR #190 remains draft.

## Covered authoring failures

| Contract category | Merchant experience | Evidence |
| --- | --- | --- |
| `screens`: missing/overlong screen name | Review names its journey position and focuses Screen name | Readiness and editor implementation; 120-character input bound |
| `questions`: missing question text, choice count, blank choice labels | Review names the screen/question/answer and focuses its stable question ID and specific choice | Regression tests; browser repaired answer 2 on the second question, leaving the first question alone |
| `results`: blank heading | Review identifies the result and opens its result tab with Heading focused | Regression tests; browser repaired the Everyone else heading |
| `results`: matching result without a condition | Review opens that result; Add condition now exists even when the imported condition is absent | Mounted repair test |
| `products`: live catalog requirements | Server retains `wconvert_optin_form_incomplete`, adds `data.issue`, and review offers Review product requirements | Real WordPress refusal without WooCommerce; opens the result screen with Require live products before publishing focused |
| Conditions, missing routes, unreachable screens, save bypasses, question budget, result links | Existing named Journey repairs | Earlier regression/browser evidence in the completion checklist |
| Required identifier, field ownership, interest choices, phone country, follow-up resource link | Existing Design block repair paths | `structure/problems.ts`; focused suites retain coverage |

The server's wording now names Journey rather than the removed manager and no
longer describes every graph as branches that must rejoin before signup.
Navigation errors explain that Continue and Save are alternatives, with No
thanks additionally required for an optional save.

## Browser evidence

Unpublished local fixture `01M3EJK75SA40GBH933WRCHBMC`:

1. Review listed the blank fallback heading and blank second answer of Roast
   preference. Selecting the latter focused Choice 2 in question `n90`, not
   Choice 2 in the preceding taste question. Entering Dark removed that blocker.
2. The result repair selected Everyone else and focused Heading. Entering
   An easy everyday favourite removed that blocker.
3. The cloned fixture's invalid page mode initially prevented saving. Selecting
   Selected pages then Entire site through Display rules normalized that QA
   configuration; saving succeeded. This was a fixture setup issue, not evidence
   that the ordinary page-mode editor creates invalid modes.
4. Read-only PHP verification confirmed no WooCommerce, unpublished state, and
   the `products` contract refusal before attempting publication. The real
   refusal displayed its repair button. It opened the correct Journey result
   and focused the product-requirements checkbox.
5. Unchecking that requirement and saving left the fixture unpublished with
   `CaptureContract::issue(...) === null`. No visitor submission occurred.

99 JS tests, 69 PHP tests / 525 assertions, TypeScript, ESLint, PHPStan, and both
admin builds pass. PHPStan also exposed a missing graph-presence guard in the
previous coffee test; the explicit assertion now matches the normalized type.

## Consent, ownership and navigation follow-up

The next browser audit found a missing authoring control: an unowned graph
field was told to choose a save without having any control to do so. Design
now offers **Saved with** on fields and consent, listing the actual save-screen
names. Choosing a save changes explicit ownership only; it does not reorder
the graph or infer a save from screen storage order. Invalid assignments are
disabled with an explanation: every path to that save must include the input
screen, and each save can own only one consent checkbox. An explicit empty
choice removes the assignment as a draft edit. Deleting a field/consent or its
containing block removes only that deleted subtree's references, so a new
checkbox is not blocked by the deleted checkbox's ID.

Graph publication review now identifies missing/conflicting Continue/Save
buttons, terminal advancing buttons, incorrect or duplicate optional exits,
invalid button save references, missing consent assignment, hidden or blank
consent, and the channel-specific required field for each signup. These links
open the affected Design element, or its named screen when a new button or
checkbox is needed. Button assignment uses the same named save points.

Local WordPress verification used the same unpublished fixture:

- Prepared unassigned, blank consent; review blocked publication and opened
  the exact consent element. Selected Optional email signup under Saved with,
  entered consent copy, and saved. The server capture contract passed.
- Deleted No thanks in Layers. Review named the optional signup and opened
  that screen. Added a button, entered No thanks, selected Skip optional signup
  and the named save point; the blocker cleared and the saved contract passed.
- Reproduced repair navigation leaving the inspector on Style, with the
  required content control hidden. A new repair request now opens Content;
  ordinary edits retain the chosen tab. Repeated the same browser sequence and
  verified Content selected and Saved with visible before repairing and saving.
- Final screenshot confirmed the full-width selector and explanatory copy fit
  the inspector. The fixture remains unpublished; no visitor submission ran.

The broader JS suite passed 3,017 tests before the final inspector-tab fix.
After that fix, 114 inspector/structure/ownership tests passed; the final
ownership/readiness tests additionally cover independent SMS requirements.
TypeScript, ESLint, Free/Pro admin builds and the source contract pass.

## Still to inspect

- Goal/save-boundary mismatches not explained by the existing required-save
  bypass repairs.
- Imported duplicate identities, invalid topology, misplaced node types and
  malformed submission records: these must remain refused; do not silently
  invent a routing or ownership change to make the error disappear.

Optional signup still does not mean optional consent: the checkbox is required
when submitting that signup. Legacy v2 consent guidance is unchanged; these
additional publication checks and assignment controls target explicit graphs.

The new issue category is additive REST metadata. Product repair uses the
single result screen permitted by the graph contract; it does not claim that
the server has identified one unavailable product or tested delivery.
