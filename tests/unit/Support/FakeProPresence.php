<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Support\ProPresence;
use WConvert\Support\Tier;

/**
 * Which tier is installed, decided by the test.
 *
 * `WCONVERT_PRO_LOADED` is a constant and a constant cannot be undefined again,
 * so a suite that arranged it for real would decide the answer for every test
 * that ran after it, and the `locked` state would be unreachable from one side.
 *
 * The default is {@see Tier::Free}, which is the install most tests mean when
 * they say nothing. `new FakeProPresence(Tier::Pro)` is a Pro install.
 */
final class FakeProPresence implements ProPresence
{
    public function __construct(private readonly Tier $tier = Tier::Free)
    {
    }

    public function installedTier(): Tier
    {
        return $this->tier;
    }
}
