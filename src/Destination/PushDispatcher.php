<?php

namespace WConvert\Destination;

use WConvert\Lead\Lead;
use WConvert\Lead\LeadCapture;
use WConvert\Optin\OptinRepository;
use WConvert\Queue\Queue;
use WConvert\Queue\QueueFailure;

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
 * **A Destination whose type is not `ready` is skipped and RECORDED, never
 * enqueued.** An Action Scheduler job whose handler is unregistered retries
 * and fails forever, silently — so a lapsed licence must not turn every
 * capture into a job nothing will ever run. The Optin keeps showing and keeps
 * capturing, because losing captures because a licence lapsed would be the one
 * genuinely unrecoverable failure available here.
 *
 * The recording is a **counter on Destination health**, not an entry per
 * capture: a skip is not a failure, so it must not touch
 * `consecutive_failures`, and a {@see DeliveryFailures} entry per capture
 * would fill a 200-entry ring in an afternoon and bury every genuine terminal
 * failure under it (#4, ADR 0008).
 *
 * ========================================================================
 * TWO ENTRANCES, AND THIS CLASS HOLDS BOTH SO THERE IS NEVER A THIRD.
 * ========================================================================
 * {@see self::dispatch()} is a captured [[Lead]]: queued, retried, counted.
 * {@see self::test()} is a merchant proving a [[Destination]] works: immediate,
 * unqueued, counted nowhere. They sit together because the interesting property
 * is the one they do NOT share, and a reader who finds only one of them will
 * write the other badly.
 *
 * @since 0.1.0
 */
final class PushDispatcher
{
    public function __construct(
        private readonly DestinationRegistry $registry,
        private readonly DestinationStore $destinations,
        private readonly OptinRepository $optins,
        private readonly HealthStore $health,
        private readonly Queue $queue,
        private readonly ConnectionStore $connections,
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

            if ($destination === null) {
                // An id naming nothing. Not a skip to record: there is no
                // Destination to record it against, and nothing a merchant
                // could do about a binding to something that no longer exists
                // except unbind it, which the builder already shows.
                continue;
            }

            if (!$this->registry->isDispatchable($destination->type)) {
                $this->health->skipped($destinationId, current_time('mysql'));

                continue;
            }

            try {
                $this->queue->dispatch(PushJob::HOOK, (new PushJob($lead->id, $destinationId))->toArgs());
            } catch (QueueFailure $failure) {
                // The Lead is already stored, so this is Destination health,
                // not a failed capture. Keep walking: one rejected action must
                // not suppress every Destination bound after it.
                $this->health->failed($destinationId, $failure->getMessage(), current_time('mysql'));
            }
        }
    }

    /**
     * What a merchant is told about a type this install cannot run.
     *
     * **One sentence, one home.** The *Test connection* route answers the same
     * situation without ever reaching {@see self::test()}, and two literals
     * would drift the moment either was reworded — which is how a screen ends
     * up giving two different explanations of one missing plugin and teaching
     * the merchant that it is guessing. `wp i18n make-pot` sees it once, too.
     */
    public static function unavailableHere(): string
    {
        return __('This Destination’s type is not available on this site.', 'wconvert');
    }

    /**
     * Send one test — **the merchant's own address, with no [[Lead]] behind
     * it.**
     *
     * ========================================================================
     * A TEST SEND NEVER WRITES A LEAD, AND IT IS NOT A POLICY, IT IS A SHAPE.
     * ========================================================================
     * A [[Lead]] has exactly one origin — a visitor submitting a form on a page
     * WConvert served — and that is total because a [[Consent Record]] is the
     * wording shown to a person at an instant (ADR 0031). A test Lead would
     * carry wording nobody was shown, which is manufactured evidence. So this
     * takes VALUES and builds its own {@see PushSubject}: there is no argument
     * a caller can pass that makes a real capture take this path, and none that
     * makes a test take the queue.
     *
     * **It is synchronous, and that is the same posture
     * {@see DestinationType::testConnection()} already has.** A merchant who
     * pressed a button is owed an answer while they are still looking at the
     * screen; a queued test would report success the moment it was queued and
     * say nothing about whether it landed, which is the one thing the button is
     * for. It also means no payload sits in `actionscheduler_actions`, so
     * {@see PushJob}'s no-Lead-data-in-arguments rule needs no exception.
     *
     * **It records NOTHING.** Not health, not a {@see DeliveryFailures} entry,
     * not a delivery count. A test that failed is not an outage — the merchant
     * asked a question and got an answer — and a merchant pressing it four
     * times while fixing an API key must not walk away with a Destination
     * marked unhealthy and a failure ring full of a Lead id that does not
     * exist. Delivery state is about Leads that were captured (ADR 0008), and
     * nothing was.
     *
     * @param array<string, mixed> $values Canonical keys; anything else is dropped.
     */
    public function test(string $destinationId, array $values): PushResult
    {
        $destination = $this->destinations->find($destinationId);

        if ($destination === null) {
            return PushResult::terminal('There is no Destination with that id.');
        }

        $type = $this->registry->find($destination->type);

        if ($type === null || !$this->registry->isDispatchable($destination->type)) {
            // The same answer `dispatch()` gives, minus the recording: a type
            // that cannot run is a skip and not a failure. Here it is simply
            // handed back, because the merchant is the one who can act on it.
            return PushResult::skipped(self::unavailableHere());
        }

        return $type->push(PushSubject::test($values), new PushContext(
            // Null, and deliberately so. `optinName` becomes `source_ref` on
            // the WSMS push, and a test send has no [[Optin]] — writing one
            // would assert provenance that does not exist, which is the case
            // {@see PushContext} already documents null for (ADR 0023).
            null,
            $destination->settings,
            $this->connections->credentialsFor($destination)
        ));
    }
}
