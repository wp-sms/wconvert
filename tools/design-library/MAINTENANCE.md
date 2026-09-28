# Maintaining the campaign library

A **design** owns layout, tokens and reusable screens. A **Playbook** combines a
Goal, a design, suggested copy and display rules. An internal **brief** explains
the visitor need, differences, prerequisites and measurement. A saved customer
Campaign owns its own prepared copy of the design, settings and content.

One design may serve several useful setups. Count those setups separately from
visually distinct designs. A different colour or industry name alone does not
justify a new design. Compare existing structures before authoring another one.

## Change a design

1. Build with `npm run templates:pilot`. In **Design maintenance and update impact**,
   choose the design. The dependency list includes every registered Playbook,
   including starts outside the curated collection. Curated entries open directly.
2. Make the source change. Keep stable leaf IDs and submission references.
3. Record the reason:

   ```sh
   npm run templates:record -- slide-in-question "Improve spacing around the topic choice"
   npm run templates:pilot
   ```

   This appends a numbered source hash and dated note in
   `review/design-history.json`. An unchanged design cannot receive another version.
   Recording a version is neither editorial approval nor publication.
4. Review all affected setups, every screen and branch, using the actual prepared
   content. The collection's existing decisions become stale when their prepared
   output changes. Also inspect registered dependents outside the collection before
   shipping; they do not automatically gain an approval from this gate.
5. Import revision-bound visual, journey and WordPress evidence, run
   `npm run templates:gate`, and submit the normal PR. The gate fails for an
   unrecorded design change, missing approval, stale output or changed evidence.

Changing only Playbook copy requires new campaign review evidence, not a design
version. Renderer and container changes require wider regression checks, including
real WordPress placement. The snapshot review hash covers the studio renderer;
it does not replace testing the shipping overlay containers.

The initial version is a baseline recorded on 28 September 2026, not a claim about
the design's original publication date. History is an internal editorial record,
not a merchant-facing update service or a downloadable catalog version.

## Editorial prompts and visual checks

The studio points out empty copy, icons without companion copy, and benefit rows
that may wrap unevenly. Site-owned wordmarks are deliberately cleared by Prefill
and are excluded from empty-copy prompts. Prompts are advisory: inspect the actual
output before deciding. A meaningful acknowledgement checkmark is allowed.

Review hierarchy, typography, spacing, icon purpose, long labels, desktop and
320px layouts, RTL, every acknowledgement and every result. Run local layout
checks, then test required fields, failure/retry, dismissal and real configured
links. Resource emails must point to useful content. A request must not claim a
booking, purchase or completed delivery. Provider delivery remains separate.

## Retire a design

Keep its source and history for traceability. In `review/design-history.json`, set
`status` to `retired`, add a plain-language `reason`, and identify an active design
with `replacement`. The build rejects unknown replacements, self-replacement and
replacement chains/cycles. The internal studio hides retired designs' setups from
normal discovery but keeps the maintenance record and dependents visible.

This metadata is **internal only**. It does not remove installed templates, rewrite
Playbooks, change the customer picker or publish/remove a downloadable pack.
Changing customer availability needs a separate reviewed packaging change. No
current design is retired by this batch.

## What happens to customer campaigns?

| Change | Existing saved campaign | Future campaign |
| --- | --- | --- |
| Update bundled design/copy | Keeps its saved tree and wording | Starts with the new version |
| Retire a design internally | Unchanged | Internal authors are directed to the replacement; shipping availability is separate |
| Fix renderer/container behaviour | May receive the behaviour fix when the plugin updates | Receives the same fix |
| Merchant chooses another design | Explicit draft edit, with existing editor undo/review | Uses the chosen design |

Never silently overwrite a merchant's edits. Any future “update available” feature
must preview the change, preserve custom content, create a recoverable draft and
require explicit application. That feature is not implemented here.

Work in batches: identify a useful uncovered need, compare, author, inspect, test,
record evidence, then expand. The working library currently contains 96 setups
using 47 designs; the full design inventory contains 79 designs. Do not count
planned briefs, colour variants or unreviewed candidates as additional designs.
