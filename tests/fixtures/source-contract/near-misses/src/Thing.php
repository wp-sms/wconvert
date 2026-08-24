<?php

namespace WConvert\Fixture;

use WConvert\Promotions\Banner;

/**
 * Free is allowed to TALK about Pro.
 *
 * The premium conditions live in WConvert\Pro\Loader\Conditions and free never
 * imports them — see ADR 0028. A check that flagged this docblock would be
 * telling us to stop documenting the boundary in order to keep the guard
 * quiet, and the exception list that follows is where a real leak hides.
 */
final class Thing
{
    public function __construct(private Banner $banner)
    {
    }
}
