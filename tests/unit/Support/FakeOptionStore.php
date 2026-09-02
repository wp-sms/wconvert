<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Storage\OptionStore;

/**
 * An in-memory option table that counts its reads and writes.
 *
 * The counters are what make it more than a stub: they are how a test asserts
 * the published set is rebuilt on write and NOT on read (ADR 0003), and how
 * the retention period is shown to be one option written once rather than a
 * value re-derived on every read.
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

    /**
     * **Everything, so a test can assert that nothing changed.**
     *
     * The one assertion this exists for is the *records-nothing* rule: a test
     * send must leave [[Destination]] health and the delivery-failure ring
     * exactly as it found them, and a test that named the two keys it expected
     * to be unchanged could not see a third somebody added later (#88).
     *
     * **The delivery COUNTERS are not here**, and it is worth saying so where
     * somebody would look: they are rows in `wconvert_stats`, written through
     * `DeliveryCount`. That claim is held against a real table in
     * `bin/verify-destinations.php` and, in the suite, by the fact that nothing
     * in the test path can write one at all.
     *
     * @return array<string, mixed>
     */
    public function all(): array
    {
        return $this->values;
    }
}
