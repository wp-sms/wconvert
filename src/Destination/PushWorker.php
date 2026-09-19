<?php

namespace WConvert\Destination;

use WConvert\Destination\LeadMagnet\DeliveryCount;
use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Queue\Queue;
use WConvert\Support\DiagnosticSanitizer;

defined('ABSPATH') || exit;

/**
 * What runs when a queued push comes up — **and where the two kinds of failure
 * are told apart.**
 *
 * The job carries two ids and an attempt number, so this is the class that
 * turns them back into a [[Lead]], a [[Destination]] and its credentials. That
 * indirection is the point: no Lead data ever sits in Action Scheduler's
 * tables (ADR 0008), and a Lead erased between capture and job is simply not
 * found — which is the correct outcome and needs no special case.
 *
 * **Everything below is about a QUEUED push, which is to say about a Lead.** A
 * test send is the other entrance and it does not come through here: it has no
 * row to key on, it is answered while the merchant is still looking at the
 * screen, and it must move none of the counters this class moves. It lives on
 * {@see PushDispatcher::test()}, beside the dispatch it is the sibling of.
 *
 * ========================================================================
 * THE FAILURE SPLIT, WHICH IS THE WHOLE OF ADR 0008.
 * ========================================================================
 * - **retryable** — the vendor is having a bad time. It is an OUTAGE: health
 *   counts it, and the job goes back on the queue with backoff.
 * - **terminal** — this Lead will never land here. It is Lead-SPECIFIC and
 *   invisible to health, so `consecutive_failures` stays where it is and the
 *   Lead lands in the bounded ring.
 * - **retries exhausted** — was retryable, is terminal now. It reaches the
 *   ring too; health already told the story.
 * - **skipped** — an ordinary outcome. It touches nothing.
 *
 * Getting that backwards is the naive implementation, and it turns a hundred
 * bad addresses into a hundred consecutive outages.
 *
 * **A retry re-runs `push()` whole**, which is safe because `push()` is
 * idempotent — the clause everything downstream stands on.
 *
 * @since 0.1.0
 */
final class PushWorker
{
    public function __construct(
        private readonly DestinationRegistry $registry,
        private readonly DestinationStore $destinations,
        private readonly ConnectionStore $connections,
        private readonly LeadRepository $leads,
        private readonly OptinRepository $optins,
        private readonly HealthStore $health,
        private readonly DeliveryFailures $failures,
        private readonly Queue $queue,
        private readonly DeliveryCount $deliveries,
    ) {
    }

    public function hooks(): void
    {
        // Action Scheduler hands the handler the ONE argument the job was
        // enqueued with, which is our args array.
        add_action(PushJob::HOOK, [$this, 'run']);
    }

    /**
     * @param array<string, mixed> $args
     */
    public function run(array $args): void
    {
        $job = PushJob::fromArgs($args);

        if ($job === null) {
            return;
        }

        $destination = $this->destinations->find($job->destinationId);

        if ($destination === null) {
            // Deleted while the job was in flight. Its health went with it, so
            // there is nowhere to record anything and nothing that would read
            // it if there were.
            return;
        }

        $type = $this->registry->find($destination->type);

        // Belt to the dispatcher's braces: a type that stopped being
        // dispatchable between enqueue and run — a licence that lapsed, a
        // plugin deactivated — is skipped rather than retried against a
        // handler that will never succeed (#4).
        if ($type === null || !$this->registry->isDispatchable($destination->type)) {
            return;
        }

        $lead = $this->leads->find($job->leadId);

        if ($lead === null) {
            // Erased or pruned since capture. **Not a delivery failure** —
            // nothing went wrong, and recording one would put a removed
            // person's id back into an option (ADR 0018).
            return;
        }

        $subject = PushSubject::of($lead);
        $credentials = $this->connections->credentialsFor($destination);
        $result = $type->push($subject, new PushContext(
            // One name, by primary key. An Optin is never hard-deleted, so
            // this is null only where something removed a row nothing should
            // remove — and an empty `source_ref` would then assert provenance
            // that is not there, which is worse than leaving the column unset
            // (ADR 0023).
            $this->optins->nameOf($lead->optinId),
            $destination->settings,
            $credentials
        ));

        $this->record($job, $lead->optinId, $destination->type, $result, $subject->values, $credentials);
    }

    /**
     * `$optinId` and `$destinationType` travel here rather than being looked
     * up again, because the only thing that reads them is
     * {@see DeliveryCount::landed()} — and it needs BOTH: a lead-magnet Optin
     * may be bound to the WSMS push as well, and counting that success as a
     * delivery would report two deliveries per Conversion (#31).
     *
     * @param array<string, string> $personal
     * @param array<string, mixed> $secrets
     */
    private function record(
        PushJob $job,
        string $optinId,
        string $destinationType,
        PushResult $result,
        array $personal,
        array $secrets
    ): void
    {
        $now = current_time('mysql');

        if ($result->outcome === PushOutcome::Success) {
            $this->health->landed($job->destinationId, $now);

            // **This is the whole of exactly-once**, and it is the shape
            // rather than a flag: the chain below re-queues only on a
            // retryable failure and stops here, so it reaches Success at most
            // once. The two seams that can replay it anyway are named in
            // {@see DeliveryCount} and clamped by the dashboard.
            $this->deliveries->landed($optinId, $destinationType);

            return;
        }

        if ($result->outcome === PushOutcome::Skipped) {
            return;
        }

        $error = DiagnosticSanitizer::message((string) $result->reason, $personal, $secrets);

        // An outage moves health. A Lead-specific rejection does not — see the
        // class docblock.
        if ($result->retryable) {
            $this->health->failed($job->destinationId, $error, $now);

            if ($job->hasAttemptsLeft()) {
                $this->queue->schedule(
                    time() + $job->backoffSeconds(),
                    PushJob::HOOK,
                    $job->next()->toArgs()
                );

                return;
            }
        }

        // Terminal: `retryable = false`, or retryable with its attempts spent.
        $this->failures->record($job->destinationId, $job->leadId, $error, $now);
    }
}
