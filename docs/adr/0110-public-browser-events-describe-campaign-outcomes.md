# 0110 — Public browser events describe campaign outcomes

Date: 2026-09-29

## Decision

Expose three non-cancellable native document events: `wconvert:open`,
`wconvert:close`, and `wconvert:capture`. Live presenters supply optional
container and journey callbacks. The renderer does not dispatch public events,
so previews remain silent. Internal screen teardown is not public close.

Opening and closing describe actual overlay transitions, including reopening.
Inline forms report only capture. Closing interrupted before hiding does not
end the open interval. A delayed native dialog event cannot hide a reopened
presentation.

Capture means the first server-acknowledged Lead in this mounted journey,
including contact before/after a quiz result. It is separate from the converting
act (ADR 0103/0106), does not repeat for optional additions, and does not confirm
provider delivery (ADR 0073). Notification follows committed acceptance and
does not depend on drawing the next screen.

Each frozen payload contains only current `campaignId`, exact `optinId`, and
`displayType`. Existing IDs become copyable in campaign details. No new slug or
storage. A promoted A/B winner keeps its own row ID as decided in ADR 0058;
listeners matching the old family may need updating.

## Consequences

Developers can coordinate page behavior without accessing closed shadow roots.
The public-event contract itself introduces no SDK, analytics bridge, network request, visitor identifier, replay queue,
custom-code editor, or cancellation mechanism is introduced. Browser events
are not guaranteed delivery: install listeners before activity, and do not
treat missing capture notifications as evidence the server did not save a Lead.

See the [public contract and examples](../guides/javascript-events.md).

**Extended by [ADR 0114](0114-analytics-exports-use-existing-site-tags.md):** A separately enabled Pro adapter consumes accepted captures and semantic presenter callbacks. Content lock now supplies the same capture notification. Public event payloads and Free availability remain unchanged.
