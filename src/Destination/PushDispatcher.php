<?php

namespace WConvert\Destination;

use WConvert\Lead\Lead;
use WConvert\Lead\LeadCapture;
use WConvert\Optin\OptinRepository;
use WConvert\Queue\Queue;

defined('ABSPATH') || exit;

/**
 * The other side of {@see LeadCapture::CAPTURED}: a [[Lead]] is in the table,
 * so now the [[Destination]]s bound to its [[Optin]] get a job each.
 *
 * **Everything is queued, including the WSMS push.** #5 had that one as an
 * in-process post-write side effect and queueing it is a refinement rather
 * than a contradiction: WSMS disclaims back-compatibility and may break
 * without notice, so a fatal inside its contact repository must not be able to
 * take down the capture request. One dispatch path, uniform partial-failure
 * semantics, and the isolation #5 asked for (#4).
 *
 * **A Destination whose type is not `ready` is skipped and never enqueued.**
 * An Action Scheduler job whose handler is unregistered retries and fails
 * forever, silently — so a lapsed licence must not turn every capture into a
 * job nothing will ever run. The Optin keeps showing and keeps capturing,
 * because losing captures because a licence lapsed would be the one genuinely
 * unrecoverable failure available here.
 *
 * @since 0.1.0
 */
final class PushDispatcher
{
    public function __construct(
        private readonly DestinationRegistry $registry,
        private readonly DestinationStore $destinations,
        private readonly OptinRepository $optins,
        private readonly Queue $queue,
    ) {
    }

    public function hooks(): void
    {
        add_action(LeadCapture::CAPTURED, [$this, 'dispatch']);
    }

    public function dispatch(Lead $lead): void
    {
        $optin = $this->optins->find($lead->optinId);

        if ($optin === null) {
            return;
        }

        foreach (OptinBinding::ids($optin->publishedConfig) as $destinationId) {
            $destination = $this->destinations->find($destinationId);

            if ($destination === null || !$this->registry->isDispatchable($destination->type)) {
                continue;
            }

            $this->queue->dispatch(PushJob::HOOK, (new PushJob($lead->id, $destinationId))->toArgs());
        }
    }
}
