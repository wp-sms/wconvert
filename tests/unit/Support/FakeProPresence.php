<?php

namespace WConvert\Tests\Unit\Support;

use WConvert\Support\ProPresence;
use WConvert\Support\Tier;

/**
 * Which tier is installed, decided by the test.
 *
 * `WCONVERT_PRO_LOADED` is a constant and a constant cannot be undefined again,
 * and the tier below it is inferred from another plugin's directory — so a
 * suite that arranged either for real would decide the answer for every test
 * that ran after it, and the `locked` state would be unreachable from both
 * sides.
 *
 * The default is {@see Tier::Free}, which is the install most tests mean when
 * they say nothing. `new FakeProPresence(Tier::Elite)` is the top rung.
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
