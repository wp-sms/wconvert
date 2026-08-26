<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * **Delivery state, at the only grain WConvert keeps it: per [[Destination]],
 * not per [[Lead]]** (ADR 0008).
 *
 * The obvious design is a `wconvert_lead_deliveries` table at the
 * per-(Lead × Destination) grain — the grain the queue already uses. It was
 * not built, and the argument that decides it is idempotency: no vendor offers
 * an idempotency header, so every push uses the vendor's identifier-keyed
 * upsert, so re-pushing a Lead that already landed is *harmless*. Once that
 * holds, exact per-Lead state buys **efficiency, not correctness**.
 *
 * So what is stored is the coarsest thing that supports actual recovery. Bulk
 * recovery is "re-push every Lead for Optins bound to this Destination since
 * `lastSuccessAt`", which answers the real support case — an expired API key
 * silently dropping three days of leads — with no new table.
 *
 * **`consecutiveFailures` counts outages and nothing else.** A Lead failing
 * for a Lead-specific terminal reason is invisible here, because a malformed
 * address is not an outage; those land in {@see DeliveryFailures} instead.
 * That distinction is the whole design, and it inverts under a naive
 * implementation that counts every failure the same.
 *
 * **`skippedCaptures` is the third thing that can go wrong, and it is neither
 * of the other two.** A Destination bound to an Optin whose TYPE is not
 * `ready` — a deactivated WSMS, a lapsed licence — is never enqueued at all,
 * because an Action Scheduler job whose handler cannot succeed retries against
 * nothing forever. That is the right behaviour and it is also completely
 * silent, so #4's "skipped and recorded" needs somewhere to record it. A
 * counter is what makes it affordable: the alternative is an entry in
 * {@see DeliveryFailures} per capture, which fills a 200-entry ring in an
 * afternoon and buries every genuine terminal failure under it.
 *
 * @since 0.1.0
 */
final class DestinationHealth
{
    public function __construct(
        public readonly ?string $lastSuccessAt = null,
        public readonly ?string $lastError = null,
        public readonly ?string $lastErrorAt = null,
        public readonly int $consecutiveFailures = 0,
        public readonly int $skippedCaptures = 0,
        public readonly ?string $lastSkippedAt = null,
    ) {
    }

    /**
     * @param array<string, mixed> $stored
     */
    public static function fromArray(array $stored): self
    {
        return new self(
            self::nullableString($stored['last_success_at'] ?? null),
            self::nullableString($stored['last_error'] ?? null),
            self::nullableString($stored['last_error_at'] ?? null),
            (int) ($stored['consecutive_failures'] ?? 0),
            (int) ($stored['skipped_captures'] ?? 0),
            self::nullableString($stored['last_skipped_at'] ?? null),
        );
    }

    /**
     * A landing clears the failure count and the error beside it.
     *
     * Clearing rather than keeping the last error is deliberate: health is
     * what a merchant reads to answer "is this working right now", and an
     * error string left standing beside a fresh success answers a different
     * question badly.
     *
     * The skip count clears for the same reason. A Destination that has just
     * landed something is running, so a standing "12 captures were not sent"
     * beside it describes an outage that is over — and the Leads behind those
     * twelve are recovered by a bulk re-push rather than by this number, which
     * is only ever the prompt to run one.
     */
    public function landed(string $at): self
    {
        return new self($at, null, null, 0);
    }

    /**
     * An outage. The count goes up; the last success stays where it was,
     * because it is the boundary a bulk re-push replays from.
     */
    public function failed(string $error, string $at): self
    {
        return new self(
            $this->lastSuccessAt,
            $error,
            $at,
            $this->consecutiveFailures + 1,
            $this->skippedCaptures,
            $this->lastSkippedAt
        );
    }

    /**
     * A capture that was never enqueued, because this Destination's type is
     * not `ready` on this install.
     *
     * **Not a failure**, so `consecutiveFailures` does not move: nothing was
     * attempted and nothing is down. It is the third state, and it is the one
     * the merchant can actually act on — reactivate the plugin, renew the
     * licence, then re-push.
     */
    public function skipped(string $at): self
    {
        return new self(
            $this->lastSuccessAt,
            $this->lastError,
            $this->lastErrorAt,
            $this->consecutiveFailures,
            $this->skippedCaptures + 1,
            $at
        );
    }

    /**
     * @return array{last_success_at: string|null, last_error: string|null, last_error_at: string|null, consecutive_failures: int, skipped_captures: int, last_skipped_at: string|null}
     */
    public function toArray(): array
    {
        return [
            'last_success_at' => $this->lastSuccessAt,
            'last_error' => $this->lastError,
            'last_error_at' => $this->lastErrorAt,
            'consecutive_failures' => $this->consecutiveFailures,
            'skipped_captures' => $this->skippedCaptures,
            'last_skipped_at' => $this->lastSkippedAt,
        ];
    }

    /**
     * @param mixed $value
     */
    private static function nullableString($value): ?string
    {
        return is_string($value) && $value !== '' ? $value : null;
    }
}
