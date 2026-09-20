# Content lock follow-up review

Scope: the local follow-up to merged PR #181 on `codex/content-lock-ui-cleanup`.
The branch starts at current `main` (`61774b3`). No open PR existed at review time;
the user subsequently authorized publishing and merging this follow-up after
the required CI checks.

## Independent review

The user requested Sol and Luna at xhigh. Sol owns functional verification;
Luna independently reviewed the UX and changed code.

Luna found one P2 consistency issue: a saved unavailable, disabled or removed
Campaign reverted to a combobox rather than retaining the selected-name card
with Change and Clear. Sol fixed this and added unavailable/missing-selection regressions. No
confirmed runtime or permission regression was found. The published Campaign
route remains limited to post/page authors and does not expose drafts, designs,
Destination configuration or Leads.

## Evidence

- Sol: all 16 content-lock browser tests passed against Playground `latest`,
  including classic/block themes, published article capture/reveal, remembered
  access, normal-block authoring, refresh/save/reopen, removal and Undo.
- Sol strengthened the technical-failure regression to exercise the divider
  directly: a 503 leaves the article readable, reports an unconfirmed submission,
  and saves no unlock receipt. The focused browser test passed.
- Focused JavaScript checks: 36 tests passed before the review fix.
- Focused PHP checks: 144 tests / 391 assertions passed.
- Source contract, type checking, lint and PHPStan passed.
- Luna verified at 420px that Choose Campaign opens a closed native sidebar.
  Her subsequent keyboard script hit a harness selector error and Playground
  stall; that was not classified as a product defect.

Final verification after the picker fix:

- Picker/selection/placement regressions: 14 tests passed.
- Rebuilt-block browser checks: 2 passed, covering post-author refresh and repair
  plus 420px closed-sidebar setup with ArrowDown/Enter selection, then desktop
  save/reopen, movement, removal and Undo.
- Final type checking, lint, block builds and whitespace checks passed.
- The exact CI loader contract passed all budgets and tier scans. All four
  visitor loader hashes remained byte-identical after rebuilding. Editor CSS
  was unchanged; the rebuilt editor JavaScript was exercised by the two affected
  browser journeys. Unaffected browser paths were not repeated unnecessarily.

No remaining product defect was found by technical validation. Luna reviewed
the final picker change and regression tests and approved closure of the P2.
GitHub CI cannot run until the follow-up PR is opened. These checks do not claim
manual screen-reader verification or universal third-party block compatibility.

## Documentation

The existing README setup section was corrected to explain both the divider and
bounded section, including sidebar Campaign setup. A future user guide belongs
at `docs/guides/content-lock.md`, linked from the README and later reusable on
the documentation website. No placeholder public documentation URL is needed.
