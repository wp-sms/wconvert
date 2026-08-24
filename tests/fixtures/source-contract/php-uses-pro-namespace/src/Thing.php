<?php

namespace WConvert\Fixture;

use WConvert\Pro\Boot\MinCoreCheck;

final class Thing
{
    public function check(): mixed
    {
        return MinCoreCheck::evaluate('1.0.0', '1.0.0');
    }
}
