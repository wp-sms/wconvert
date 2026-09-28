# Follow-up hierarchy and test summary

## Recommendation

Keep the popup/question editor as the primary workspace. Organize conditional
follow-ups under the answer source. Use the flow map to inspect audience paths
and shared continuation, with individual connections available explicitly.

Two separate concepts must remain visible:

- **One path is followed:** home OR business, resolved by first-match priority.
- **Every matching follow-up is asked:** garden AND indoor plants can both be
  selected, producing two separate questions in saved order before one enquiry.

Grouping describes the relationship between questions; it does not run visitor
screens in parallel or combine them into one page. For Demo 04, selecting Garden
landscaping and Indoor plants produces Garden details → Indoor details → one
combined enquiry. Balcony and irrigation are skipped.

## Research and rationale

[Typeform branching](https://help.typeform.com/hc/en-us/articles/360029116392-What-is-branching-logic)
separates changing the next destination from hiding individual questions. It
supports question groups, answer-level branching controls and a logic map for
review/troubleshooting. Its first matching branching rule wins.

[Qualtrics display logic](https://www.qualtrics.com/support/survey-platform/survey-module/question-options/display-logic/)
distinguishes showing individual relevant questions from skipping to later
sections. This supports presenting independent follow-ups differently from
exclusive audience paths.

[NN/g progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
supports keeping routine information prominent while revealing secondary detail
on demand. Here, current test position and capture status remain visible, while
visited, skipped and unevaluated screens are expandable.

[React Flow sub-flows](https://reactflow.dev/learn/layouting/sub-flows) provides
nested/grouped presentation. We already have a suitable custom group card; this
iteration needs no extra library or paid add-on. A new layout library would not,
by itself, communicate the difference between branching and conditional display.

These are findings from official documentation and published usability guidance,
not a claim of hands-on testing of competitors' authenticated editors.

## Implemented locally

- Navigation nests each unambiguous independent follow-up group beneath its
  directly preceding source question. Other groups remain explicit when topology
  does not establish one owner. Every screen is rendered once.
- Groups expand for the selected question/child and can be opened manually.
  Audience-path labels and “Only one path is followed” distinguish branch choices.
- Short complete rules read “If ‘Garden landscaping’ is selected”; complex rules
  retain their full condition text.
- Flow groups name their source and show conditional children. Selecting a child
  no longer automatically expands the group into a chain of nodes. Explicit path
  inspection and “Edit individual connections” still reveal the raw connections.
- Follow-up inspector continuation says “Check remaining follow-ups” and names
  the shared destination instead of implying the next optional question is required.
- Test summary shows the current screen, with separate collapsed sections for
  visited, skipped and not-yet-reached screens. Visited screens use actual visit
  order. Future rules are not reported as evaluated.
- Matching groups show “Follow-up 1 of 2 for these answers.” Skipped-condition
  repair links retain their context and open the condition itself.

No visitor routing, storage schema, submission contract, campaign content or
publication status changes. No GitHub CI or VoiceOver run.

## Verification

79 targeted tests pass across journey-editor (59), journey-test (9),
followup-groups (7), journey-map-controls (3), and campaign-screen-navigator (1).
TypeScript, changed-file lint, whitespace checks and both admin builds pass.
Builds retain the existing bundle-size warnings.

Browser checks on local WordPress:
- Demo 04 home/business groups are distinct, nested and collapsible. Selecting a
  home child keeps seven map nodes including both follow-up groups, rather than
  expanding the children into a chain. The inspector edits the selected child.
- Garden + Indoor yields Follow-up 1 of 2, then 2 of 2; Indoor alone yields 1 of 1.
- Skipped screens reveal explanations and repair actions on request. Edit
  condition opens the actual visibility controls for Garden landscaping.
- Current-screen and capture information are visible in the compact desktop test
  sidebar. At 390x844, the modal stacks correctly and its body scrolls; viewport
  restored afterward.
- No browser console errors. Save draft disabled after QA: demo content was not
  modified or published. Existing local branch/PR remains unmerged.
