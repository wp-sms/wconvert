<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Support\ProPresence;

/**
 * Pro's presence, decided by the test.
 *
 * `WCONVERT_PRO_LOADED` is a constant, and a constant cannot be undefined
 * again — so a suite that defined it would decide the answer for every test
 * that ran after it, and the `locked` state would be unreachable from either
 * side.
 */
final class FakeProPresence implements ProPresence
{
    public function __construct(private readonly bool $loaded = false)
    {
    }

    public function isLoaded(): bool
    {
        return $this->loaded;
    }
}
