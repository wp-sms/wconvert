<?php

namespace WConvert\Destination;

use WConvert\Storage\OptionStore;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * Configured [[Destination]]s, in one non-autoloaded option.
 *
 * **An option and not a table**, which the database rule asks to have argued
 * rather than assumed. A site has a handful of Destinations, they are read
 * whole on the capture path and written whole by an admin, and nothing queries
 * across them — which is the shape an option already serves and a table would
 * only make heavier. Delivery state was the one thing here that could have
 * needed a table, and idempotent `push()` is what removed the need (ADR 0008).
 *
 * Health is deliberately **not** in this option. See {@see HealthStore}.
 *
 * @since 0.1.0
 */
final class DestinationStore
{
    public const OPTION = 'wconvert_destinations';

    public function __construct(
        private readonly OptionStore $options,
    ) {
    }

    /**
     * @return array<string, Destination>
     */
    public function all(): array
    {
        $stored = $this->options->get(self::OPTION, []);
        $destinations = [];

        foreach (is_array($stored) ? $stored : [] as $id => $entry) {
            if (is_array($entry)) {
                $destinations[(string) $id] = Destination::fromArray((string) $id, $entry);
            }
        }

        return $destinations;
    }

    public function find(string $id): ?Destination
    {
        return $this->all()[$id] ?? null;
    }

    /**
     * Save one Destination, minting an id where it has none.
     *
     * A ULID like every other id WConvert issues, so an id is never a
     * sequential integer a page can leak (ADR 0001).
     *
     * @param array<string, mixed> $settings
     */
    public function save(?string $id, string $type, string $label, ?string $connectionId, array $settings): Destination
    {
        $destination = new Destination(
            $id !== null && $id !== '' ? $id : Ulid::generate(),
            $type,
            $label,
            $connectionId,
            $settings
        );

        $all = $this->all();
        $all[$destination->id] = $destination;

        $this->write($all);

        return $destination;
    }

    public function delete(string $id): bool
    {
        $all = $this->all();

        if (!isset($all[$id])) {
            return false;
        }

        unset($all[$id]);
        $this->write($all);

        return true;
    }

    /**
     * @param array<string, Destination> $all
     */
    private function write(array $all): void
    {
        $this->options->set(self::OPTION, array_map(
            static fn (Destination $destination): array => $destination->toArray(),
            $all
        ));
    }
}
