<?php

namespace WConvert\Destination;

use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * One queued push: **a [[Lead]] id, a [[Destination]] id, and an attempt
 * number.**
 *
 * ========================================================================
 * NO LEAD DATA EVER REACHES A JOB'S ARGUMENTS.
 * ========================================================================
 * Not the email, not the phone, not a captured field, not the consent
 * sentence. Personal data in a job argument sits in `actionscheduler_actions`
 * for Action Scheduler's whole retention period, **outliving any retention
 * policy WConvert sets for itself** — so an erasure request honoured against
 * `wconvert_leads` would leave the same address sitting in another plugin's
 * table (ADR 0008, ADR 0018).
 *
 * The two ids are what the worker re-reads everything from, and a Lead that
 * has since been erased or pruned simply is not there — which is the correct
 * outcome rather than a race to handle.
 *
 * `tests/unit/Destination/JobPayloadTest.php` holds this from both sides: the
 * shape of the args, and a dispatch of a Lead stuffed with personal data whose
 * queued arguments contain none of it.
 *
 * **The attempt counter is not Lead data**, and it has to be here: Action
 * Scheduler does not retry a failed action — it marks it failed — so the
 * backoff is WConvert's own, exactly as WSMS's `JobProcessor` does it.
 *
 * @since 0.1.0
 */
final class PushJob
{
    /**
     * The Action Scheduler hook every push runs under.
     *
     * One hook for every Destination type rather than one per type: the
     * handler re-reads the Destination anyway, and a hook per type would make
     * an unregistered type an unhandled hook — which Action Scheduler retries
     * against nothing, forever, silently.
     */
    public const HOOK = 'wconvert_push_lead';

    /**
     * Five, then it is terminal.
     *
     * The number is a judgement rather than a calculation: enough to ride out
     * a vendor's bad afternoon, few enough that a genuinely broken
     * configuration reaches the failure ring the same day someone can look at
     * it.
     */
    public const MAX_ATTEMPTS = 5;

    /** One minute, doubling. Attempt 5 waits sixteen minutes. */
    private const BACKOFF_SECONDS = 60;

    public function __construct(
        public readonly string $leadId,
        public readonly string $destinationId,
        public readonly int $attempt = 1,
    ) {
    }

    /**
     * @param array<string, mixed> $args
     * @return self|null Null for arguments this plugin did not write.
     */
    public static function fromArgs(array $args): ?self
    {
        $leadId = (string) ($args['lead'] ?? '');
        $destinationId = (string) ($args['destination'] ?? '');

        if (!Ulid::isOne($leadId) || !Ulid::isOne($destinationId)) {
            return null;
        }

        return new self($leadId, $destinationId, max(1, (int) ($args['attempt'] ?? 1)));
    }

    /**
     * @return array{lead: string, destination: string, attempt: int}
     */
    public function toArgs(): array
    {
        return ['lead' => $this->leadId, 'destination' => $this->destinationId, 'attempt' => $this->attempt];
    }

    public function hasAttemptsLeft(): bool
    {
        return $this->attempt < self::MAX_ATTEMPTS;
    }

    public function next(): self
    {
        return new self($this->leadId, $this->destinationId, $this->attempt + 1);
    }

    /**
     * How long before the next attempt — exponential, from the attempt just
     * made.
     */
    public function backoffSeconds(): int
    {
        return self::BACKOFF_SECONDS * (2 ** ($this->attempt - 1));
    }
}
