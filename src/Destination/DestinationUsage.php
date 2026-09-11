<?php

namespace WConvert\Destination;

use WConvert\Database\Connection;

defined('ABSPATH') || exit;

/** One admin read of saved bindings; never a new index or a public-page query. */
final class DestinationUsage
{
    public function __construct(private readonly Connection $db)
    {
    }

    /** @return array<string, list<array{id: string, name: string, draft: bool, live: bool}>> */
    public function all(): array
    {
        $usage = [];
        $rows = $this->db->results(Connection::TABLE_OPTINS,
            'SELECT id, name, config, published_config, published_at, deleted_at FROM %i WHERE deleted_at IS NULL ORDER BY id ASC');
        foreach ($rows as $row) {
            if (($row['deleted_at'] ?? null) !== null) continue;
            $draft = self::bindings($row['config'] ?? null);
            $live = ($row['published_at'] ?? null) === null ? [] : self::bindings($row['published_config'] ?? null);
            foreach (array_unique([...$draft, ...$live]) as $destination) {
                $usage[$destination][] = ['id' => (string) $row['id'], 'name' => (string) ($row['name'] ?? ''),
                    'draft' => in_array($destination, $draft, true), 'live' => in_array($destination, $live, true)];
            }
        }
        return $usage;
    }

    /** @return list<string> */
    private static function bindings(?string $json): array
    {
        $config = json_decode($json ?? '', true);
        return OptinBinding::ids(is_array($config) ? $config : null);
    }
}
