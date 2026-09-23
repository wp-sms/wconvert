<?php

namespace WConvert\Destination;

use WConvert\Lead\LeadRepository;
use WConvert\Optin\OptinRepository;
use WConvert\Queue\Queue;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * **Re-push every [[Lead]] for [[Optin]]s bound to this [[Destination]] since
 * `last_success_at`** — the whole of operational recovery, and the feature
 * that made a `wconvert_lead_deliveries` table unnecessary (ADR 0008).
 *
 * It is affordable only because `push()` is idempotent. Replaying a window
 * necessarily replays the Leads that DID land inside it, and without the
 * vendor's identifier-keyed upsert underneath, every recovery would double the
 * merchant's list.
 *
 * **Merchant-driven, never automatic.** Retries are the queue's business; this
 * is somebody deciding that three days went missing.
 *
 * ========================================================================
 * THE WINDOW IS A RANGE OVER THE PRIMARY KEY, AND IT NEEDS NO NEW INDEX.
 * ========================================================================
 * `wconvert_leads` carries two indexes and `Schema` left the question of a
 * third open for this ticket. The answer is no. A ULID's leading 48 bits are
 * the minting time, so `id > floorAt(lastSuccess)` names the same rows
 * `created_at > lastSuccess` would, and the per-Optin filter rides on top of
 * that bounded range under a `LIMIT`. An index would be paid on every capture
 * to speed a job a human triggers by hand — the same asymmetry ADR 0033
 * decided the same way for the lead log.
 *
 * A boundary that lands slightly early only widens a re-push that is already
 * idempotent, which is the same tolerance ADR 0008 grants health's lost
 * increments.
 *
 * @since 0.1.0
 */
final class BulkRePush
{
    /**
     * How many Leads are read at a time — a keyset walk, so the cursor is the
     * primary key the rows are already ordered by.
     */
    private const BATCH = 200;

    /**
     * A ceiling on one replay, so a button press cannot enqueue a million
     * jobs. Hitting it is REPORTED rather than swallowed
     * ({@see RePushReport::$capped}); the operator runs it again once the
     * first pass has moved `last_success_at` forward.
     */
    private const MAX_JOBS = 10000;

    private const MINUTE = 60;

    public function __construct(
        private readonly DestinationRegistry $registry,
        private readonly DestinationStore $destinations,
        private readonly OptinRepository $optins,
        private readonly LeadRepository $leads,
        private readonly HealthStore $health,
        private readonly Queue $queue,
    ) {
    }

    public function run(string $destinationId): RePushReport
    {
        $destination = $this->destinations->find($destinationId);

        if ($destination === null || !$this->registry->isDispatchable($destination->type)) {
            return new RePushReport(0, false, null);
        }

        $throughput = max(1, ($this->registry->find($destination->type)?->throughput()) ?? 1);
        $since = $this->health->of($destinationId)->lastSuccessAt;
        $queued = 0;

        foreach ($this->boundOptins($destinationId) as $optinId) {
            $queued = $this->replayOptin($optinId, $destinationId, $this->boundary($since), $throughput, $queued);

            if ($queued >= self::MAX_JOBS) {
                return new RePushReport($queued, true, $since);
            }
        }

        return new RePushReport($queued, false, $since);
    }

    /**
     * @return list<string>
     */
    private function boundOptins(string $destinationId): array
    {
        $bound = [];

        foreach ($this->optins->publishedConfigs() as $optinId => $config) {
            if (OptinBinding::binds($config, $destinationId)) {
                $bound[] = (string) $optinId;
            }
        }

        return $bound;
    }

    /**
     * The id below which every Lead predates the window.
     *
     * `last_success_at` is written by `current_time('mysql')` and is therefore
     * in the SITE's timezone, while a ULID's timestamp is real epoch
     * milliseconds. WordPress is the only thing that knows the offset, so the
     * conversion goes through it rather than through `strtotime()` on a local
     * string — which would silently shift the window by the site's UTC offset
     * on every install that is not on UTC.
     *
     * A null `last_success_at` means this Destination has never landed
     * anything, so the window is the whole log.
     */
    private function boundary(?string $since): string
    {
        if ($since === null) {
            return Ulid::floorAt(0);
        }

        return Ulid::floorAt((int) max(0, strtotime(get_gmt_from_date($since) . ' UTC') - \WConvert\Lead\CaptureGrant::LIFETIME) * 1000);
    }

    /**
     * One Optin's Leads, walked forward from the boundary and queued with a
     * stagger.
     */
    private function replayOptin(
        string $optinId,
        string $destinationId,
        string $boundary,
        int $throughput,
        int $queued
    ): int {
        $cursor = $boundary;
        $now = time();

        while ($queued < self::MAX_JOBS) {
            $page = $this->leads->since($optinId, $cursor, self::BATCH);

            foreach ($page as $lead) {
                if ($queued >= self::MAX_JOBS) {
                    return $queued;
                }

                // The stagger, and the whole of rate limiting in v1: the Nth
                // job of a replay waits `N / throughput` minutes. Immediate
                // dispatch stays immediate — only this is slowed (ADR 0008).
                foreach ($lead->capture['submissions'] ?? [] as $submissionId => $submission) {
                    if (!in_array($destinationId, $submission['destination_ids'] ?? [], true)) { continue; }
                    if ($queued >= self::MAX_JOBS) { return $queued; }
                    $this->queue->schedule(
                        $now + intdiv($queued, $throughput) * self::MINUTE,
                        PushJob::HOOK,
                        (new PushJob($lead->id, $destinationId, 1, $submissionId))->toArgs()
                    );
                    $queued++;
                }
                $cursor = $lead->id;
            }

            if (count($page) < self::BATCH) {
                return $queued;
            }
        }

        return $queued;
    }
}
