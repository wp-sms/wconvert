<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Database\Connection;

/**
 * An in-memory WConvert table.
 *
 * It models the TABLE rather than the SQL: reads answer from the stored rows
 * and ignore the query text. That is the right trade for what these tests are
 * about — whether publishing promotes and rebuilds, whether deleting is a
 * stamp — and the SQL itself is verified where SQL can only be verified, on a
 * real WordPress.
 *
 * What it does keep is every statement it was handed, so a test can assert on
 * the shape of what was issued. {@see self::$statements}.
 *
 * An AGGREGATE has no rows to model — a `GROUP BY` produces a result set that
 * exists nowhere in the table — so {@see self::$answers} lets a test hand one
 * back. Re-implementing `GROUP BY` here would make the fake the authority on
 * what SQL does, which is the one thing it must never be: the test would then
 * agree with this file rather than with a database.
 */
final class FakeConnection implements Connection
{
    /** @var array<string, array<string, string|null>> */
    public array $rows = [];

    /** @var list<string> Every SQL string this connection was asked to run. */
    public array $statements = [];

    /** @var list<array{table: string, data: array<string, mixed>, where: array<string, mixed>|null}> */
    public array $writes = [];

    /** @var list<array{table: string, sql: string, params: list<mixed>}> Every DELETE it was asked to run. */
    public array $deletes = [];

    /** @var list<array{table: string, sql: string, params: list<mixed>}> Every read, with what was bound to it. */
    public array $reads = [];

    /** @var list<list<array<string, string|null>>> Canned result sets, taken in order by {@see self::results()}. */
    public array $answers = [];

    /** @var int What the next {@see self::delete()} reports it removed. */
    public int $removes = 0;

    /**
     * @param mixed ...$params
     * @return list<array<string, string|null>>
     */
    public function results(string $table, string $sql, ...$params): array
    {
        $this->statements[] = $sql;
        $this->reads[] = ['table' => $table, 'sql' => $sql, 'params' => array_values($params)];

        if ($this->answers !== []) {
            return array_shift($this->answers);
        }

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
        $this->reads[] = ['table' => $table, 'sql' => $sql, 'params' => array_values($params)];

        if ($this->answers !== []) {
            $answer = array_shift($this->answers);

            return $answer[0] ?? null;
        }

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

    /**
     * @param mixed ...$params
     */
    public function delete(string $table, string $sql, ...$params): int
    {
        $this->statements[] = $sql;
        $this->deletes[] = ['table' => $table, 'sql' => $sql, 'params' => array_values($params)];

        return $this->removes;
    }
}
