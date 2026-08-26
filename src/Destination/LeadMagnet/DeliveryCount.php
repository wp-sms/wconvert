<?php

namespace WConvert\Destination\LeadMagnet;

use WConvert\Optin\OptinRepository;
use WConvert\Stats\StatDay;
use WConvert\Stats\StatKind;
use WConvert\Stats\StatsRepository;

defined('ABSPATH') || exit;

/**
 * The one place `lead_magnet_delivered` is written — **and the two scopes that
 * decide when.**
 *
 * ============================================================================
 * BOTH SCOPES, OR THE NUMBER IS WRONG ON AN ORDINARY SITE.
 * ============================================================================
 * - **By [[Goal]].** Only an Optin whose Goal reports deliveries has anything
 *   to count. Counting elsewhere would put rows on a card that never reads
 *   them and would make `conversions − lead_magnet_delivered` meaningless on
 *   the Goal that does.
 * - **By [[Destination]] type.** A merchant can bind the WSMS push *and* the
 *   delivery email to one lead-magnet Optin — an entirely ordinary
 *   configuration — and counting the WSMS success as a delivery would report
 *   two deliveries per Conversion and a negative failure count.
 *
 * The second is the one that is easy to miss, because the first sounds
 * complete on its own.
 *
 * **Neither can become a method on `DestinationType`.** Its docblock refuses
 * the `Supports*` capability split outright, and a `countsDeliveries()` there
 * would be that split reopened for one type. So both rules live here, in the
 * delivery type's OWN namespace: what that keeps local is the comparison
 * against {@see LeadMagnetDestinationType::ID} below — a generic worker
 * spelling a concrete type's id would be the thing worth avoiding.
 * {@see \WConvert\Destination\PushWorker} names this collaborator openly and
 * has to; that is an injected dependency, not a special case.
 *
 * ============================================================================
 * IT TAKES AN OPTIN ID AND NEVER A LEAD.
 * ============================================================================
 * That is deliberate and it is load-bearing.
 * `tests/unit/Stats/NoCountComesFromTheLeadLogTest.php` walks the dependency
 * closure of every class a reported number can come from and fails if one
 * reaches `WConvert\Lead\` at all — because a reporting path that can reach a
 * [[Lead]] is one edit away from counting one, and erasure `DELETE`s those
 * rows (ADR 0018). This class is a WRITER rather than a reporter and so is
 * outside that closure today; taking a `Lead` would be the edit that makes the
 * question live.
 *
 * ============================================================================
 * EXACTLY ONCE IS A PROPERTY OF THE JOB CHAIN, NOT OF A STORED FLAG.
 * ============================================================================
 * There is no per-Lead delivery marker and `wconvert_leads` has no column for
 * one. It does not need either: `PushDispatcher` fires once per capture,
 * {@see \WConvert\Destination\PushWorker::record()} re-queues **only** on a
 * retryable failure, and the chain stops at `PushOutcome::Success`. A chain
 * therefore reaches Success at most once.
 *
 * **Two seams are accepted rather than hidden**, and both are written down in
 * ADR 0008:
 *
 * - {@see \WConvert\Destination\BulkRePush} — a button a merchant presses —
 *   replays Leads that already landed. For every other type that is harmless
 *   because vendors upsert on email; `wp_mail()` has no upsert, so it
 *   re-sends the file and re-counts.
 * - Action Scheduler resetting a stuck action replays identical arguments.
 *
 * Because an over-count is possible, {@see \WConvert\Stats\Dashboard} clamps
 * the subtraction at zero. That clamp is not defensive padding: a Conversion
 * at 23:58 and its delivery at 00:01 land on different `stat_date`s, so on a
 * one-day window the card would print a negative number most mornings without
 * it.
 *
 * @since 0.1.0
 */
final class DeliveryCount
{
    public function __construct(
        private readonly OptinRepository $optins,
        private readonly StatsRepository $stats,
    ) {
    }

    /**
     * One delivery landed — count it, if it was one.
     *
     * The Goal test is `headlineKind()` rather than a comparison against
     * `Goal::DeliverLeadMagnet`. Both are true today and only one stays true:
     * the kind is what the card actually reads, so a second Goal that reported
     * deliveries would be counted by this method with no edit, and a Goal that
     * stopped reporting them would stop being counted the same way.
     *
     * **The Optin's published state is not checked**, unlike
     * {@see \WConvert\Rest\BeaconController}. The Lead was captured under this
     * Optin and `Dashboard` interprets counts against soft-deleted Optins too
     * (ADR 0020) — an Optin unpublished between capture and delivery still
     * owns the delivery, and dropping it here would lose a count the card is
     * still adding up.
     */
    public function landed(string $optinId, string $destinationType): void
    {
        if ($destinationType !== LeadMagnetDestinationType::ID) {
            return;
        }

        if ($this->optins->goalOf($optinId)?->headlineKind() !== StatKind::LeadMagnetDelivered) {
            return;
        }

        // The site's day, resolved at the boundary — the same rule every other
        // counted act follows, and the reason `StatsRepository` has no clock
        // (ADR 0019).
        $this->stats->increment($optinId, StatKind::LeadMagnetDelivered, StatDay::today());
    }
}
