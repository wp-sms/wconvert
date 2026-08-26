<?php

namespace WConvert\Destination;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/**
 * {@see DestinationHealth} for every [[Destination]], in **its own
 * non-autoloaded option** — separate from Destination configuration, and that
 * separation is the point.
 *
 * `update_option` is a read-modify-write with no row lock, so two jobs
 * completing at once will lose an increment. **That race is tolerable here**
 * for the same reason the whole design works: health is advisory, and a
 * `last_success_at` that moves backwards only widens a re-push that is already
 * idempotent. Keeping health OUT of the config option is what stops the same
 * race eating an admin's edit, which would not be tolerable (ADR 0008).
 *
 * The race is not the same one {@see \WConvert\Database\Connection::upsert()}
 * refuses for analytics. A conversion count is not advisory and cannot be
 * reconstructed, which is why that one is a single atomic statement and this
 * one is allowed to be sloppy.
 *
 * @since 0.1.0
 */
final class HealthStore
{
    public const OPTION = 'wconvert_destination_health';

    public function __construct(
        private readonly OptionStore $options,
    ) {
    }

    public function of(string $destinationId): DestinationHealth
    {
        $all = $this->all();

        return $all[$destinationId] ?? new DestinationHealth();
    }

    /**
     * @return array<string, DestinationHealth>
     */
    public function all(): array
    {
        $stored = $this->options->get(self::OPTION, []);
        $health = [];

        foreach (is_array($stored) ? $stored : [] as $id => $entry) {
            if (is_array($entry)) {
                $health[(string) $id] = DestinationHealth::fromArray($entry);
            }
        }

        return $health;
    }

    public function landed(string $destinationId, string $at): void
    {
        $this->write($destinationId, $this->of($destinationId)->landed($at));
    }

    /**
     * Record an outage.
     *
     * **Only a retryable failure reaches here.** A terminal one is
     * Lead-specific and must leave `consecutive_failures` at zero — that is
     * the distinction ADR 0008 is built on, and the caller
     * ({@see PushWorker}) is where it is decided.
     */
    public function failed(string $destinationId, string $error, string $at): void
    {
        $this->write($destinationId, $this->of($destinationId)->failed($error, $at));
    }

    /**
     * Forget a Destination's health — what deleting the Destination does.
     *
     * Health keyed by an id nothing references is a row that never goes away
     * on a site that has reconfigured its integrations a few times.
     */
    public function forget(string $destinationId): void
    {
        $all = $this->all();

        unset($all[$destinationId]);

        $this->options->set(self::OPTION, array_map(
            static fn (DestinationHealth $health): array => $health->toArray(),
            $all
        ));
    }

    private function write(string $destinationId, DestinationHealth $health): void
    {
        $all = $this->all();
        $all[$destinationId] = $health;

        $this->options->set(self::OPTION, array_map(
            static fn (DestinationHealth $entry): array => $entry->toArray(),
            $all
        ));
    }
}
