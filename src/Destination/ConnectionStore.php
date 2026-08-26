<?php

namespace WConvert\Destination;

use WConvert\Storage\OptionStore;
use WConvert\Support\Ulid;

defined('ABSPATH') || exit;

/**
 * [[Connection]]s — credentials for one remote account each — in their own
 * non-autoloaded option, beside {@see DestinationStore} rather than inside it.
 *
 * Separate because the lifetimes differ: a merchant may reconfigure which
 * audience a Destination targets a dozen times without ever touching the key
 * underneath it, and two Destinations sharing that key must share one copy of
 * it or the merchant has two places to rotate it.
 *
 * **A free install writes nothing here.** The WSMS push authenticates against
 * nothing and the lead-magnet email has no account; every Destination type
 * with credentials is Pro's (#4). The store exists in free anyway because the
 * shape of the contract is free's — Pro supplies types, never plumbing.
 *
 * @since 0.1.0
 */
final class ConnectionStore
{
    public const OPTION = 'wconvert_connections';

    public function __construct(
        private readonly OptionStore $options,
    ) {
    }

    /**
     * @return array<string, Connection>
     */
    public function all(): array
    {
        $stored = $this->options->get(self::OPTION, []);
        $connections = [];

        foreach (is_array($stored) ? $stored : [] as $id => $entry) {
            if (is_array($entry)) {
                $connections[(string) $id] = Connection::fromArray((string) $id, $entry);
            }
        }

        return $connections;
    }

    public function find(string $id): ?Connection
    {
        return $this->all()[$id] ?? null;
    }

    /**
     * The credentials for one Destination, or `[]` where it has no Connection.
     *
     * @return array<string, mixed>
     */
    public function credentialsFor(Destination $destination): array
    {
        if ($destination->connectionId === null) {
            return [];
        }

        $connection = $this->find($destination->connectionId);

        return $connection === null ? [] : $connection->credentials;
    }

    /**
     * @param array<string, mixed> $credentials
     */
    public function save(?string $id, string $type, string $label, array $credentials): Connection
    {
        $connection = new Connection(
            $id !== null && $id !== '' ? $id : Ulid::generate(),
            $type,
            $label,
            $credentials
        );

        $all = $this->all();
        $all[$connection->id] = $connection;

        $this->options->set(self::OPTION, array_map(
            static fn (Connection $entry): array => $entry->toArray(),
            $all
        ));

        return $connection;
    }
}
