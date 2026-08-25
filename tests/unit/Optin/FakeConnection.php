<?php

namespace WConvert\Tests\Unit\Optin;

use WConvert\Database\Connection;

/**
 * An in-memory `wconvert_optins`.
 *
 * It models the TABLE rather than the SQL: reads answer from the stored rows
 * and ignore the query text. That is the right trade for what these tests are
 * about — whether publishing promotes and rebuilds, whether deleting is a
 * stamp — and the SQL itself is verified where SQL can only be verified, on a
 * real WordPress.
 *
 * What it does keep is every statement it was handed, so a test can assert on
 * the shape of what was issued. {@see self::$statements}.
 */
final class FakeConnection implements Connection
{
    /** @var array<string, array<string, string|null>> */
    public array $rows = [];

    /** @var list<string> Every SQL string this connection was asked to run. */
    public array $statements = [];

    /** @var list<array{table: string, data: array<string, mixed>, where: array<string, mixed>|null}> */
    public array $writes = [];

    /**
     * @param mixed ...$params
     * @return list<array<string, string|null>>
     */
    public function results(string $table, string $sql, ...$params): array
    {
        $this->statements[] = $sql;

        $rows = array_values($this->rows);
        usort($rows, static fn (array $a, array $b): int => strcmp((string) $b['id'], (string) $a['id']));

        return $rows;
    }

    /**
     * @param mixed ...$params
     * @return array<string, string|null>|null
     */
    public function row(string $table, string $sql, ...$params): ?array
    {
        $this->statements[] = $sql;

        $id = isset($params[0]) ? (string) $params[0] : '';

        return $this->rows[$id] ?? null;
    }

    /**
     * @param array<string, mixed> $data
     */
    public function insert(string $table, array $data): void
    {
        $this->writes[] = ['table' => $table, 'data' => $data, 'where' => null];

        /** @var array<string, string|null> $row */
        $row = array_map(static fn ($v): ?string => $v === null ? null : (string) $v, $data);

        $this->rows[(string) $data['id']] = $row;
    }

    /**
     * @param array<string, mixed> $data
     * @param array<string, mixed> $where
     */
    public function update(string $table, array $data, array $where): void
    {
        $this->writes[] = ['table' => $table, 'data' => $data, 'where' => $where];

        $id = (string) ($where['id'] ?? '');

        if (!isset($this->rows[$id])) {
            return;
        }

        foreach ($data as $column => $value) {
            $this->rows[$id][$column] = $value === null ? null : (string) $value;
        }
    }
}
