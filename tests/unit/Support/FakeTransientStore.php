<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Storage\TransientStore;

/**
 * An in-memory transient store, with a clock a test drives.
 *
 * Expiry is MODELLED rather than ignored, because expiry is the whole point of
 * the thing being stored in one: the beacon's rate limit is a window, and a
 * fake that never let a window lapse would make "the allowance comes back"
 * untestable without sleeping for a minute.
 *
 * {@see self::$now} is the clock. It starts at a fixed instant rather than at
 * `time()` so a test that advances it reads as arithmetic rather than as a
 * race, and `WpTransientStore`'s own answer — an absent value is the caller's
 * default, never `false` — is reproduced here.
 */
final class FakeTransientStore implements TransientStore
{
    /** Seconds. Advance it to move past an expiry. */
    public int $now = 1_700_000_000;

    /** @var array<string, array{value: mixed, expires: int}> */
    public array $stored = [];

    /**
     * @param mixed $default
     * @return mixed
     */
    public function get(string $key, $default = null)
    {
        $held = $this->stored[$key] ?? null;

        if ($held === null || $held['expires'] <= $this->now) {
            return $default;
        }

        return $held['value'];
    }

    /**
     * @param mixed $value
     * @param positive-int $expiresIn
     */
    public function set(string $key, $value, int $expiresIn): void
    {
        $this->stored[$key] = ['value' => $value, 'expires' => $this->now + $expiresIn];
    }
}
