<?php

namespace WConvert\Tests\Unit\Optin;

use WConvert\Storage\OptionStore;

/**
 * An in-memory option table that counts its writes, so a test can assert the
 * published set is rebuilt on write and NOT on read (ADR 0003).
 */
final class FakeOptionStore implements OptionStore
{
    /** @var array<string, mixed> */
    private array $values = [];

    public int $reads = 0;

    public int $writes = 0;

    /**
     * @param mixed $default
     * @return mixed
     */
    public function get(string $key, $default = null)
    {
        $this->reads++;

        return $this->values[$key] ?? $default;
    }

    /**
     * @param mixed $value
     */
    public function set(string $key, $value): void
    {
        $this->writes++;
        $this->values[$key] = $value;
    }
}
