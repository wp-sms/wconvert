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
 * @since 0.1.0
 */
final class DestinationHealth
{
    public function __construct(
        public readonly ?string $lastSuccessAt = null,
        public readonly ?string $lastError = null,
        public readonly ?string $lastErrorAt = null,
        public readonly int $consecutiveFailures = 0,
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
        );
    }

    /**
     * A landing clears the failure count and the error beside it.
     *
     * Clearing rather than keeping the last error is deliberate: health is
     * what a merchant reads to answer "is this working right now", and an
     * error string left standing beside a fresh success answers a different
     * question badly.
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
        return new self($this->lastSuccessAt, $error, $at, $this->consecutiveFailures + 1);
    }

    /**
     * @return array{last_success_at: string|null, last_error: string|null, last_error_at: string|null, consecutive_failures: int}
     */
    public function toArray(): array
    {
        return [
            'last_success_at' => $this->lastSuccessAt,
            'last_error' => $this->lastError,
            'last_error_at' => $this->lastErrorAt,
            'consecutive_failures' => $this->consecutiveFailures,
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
