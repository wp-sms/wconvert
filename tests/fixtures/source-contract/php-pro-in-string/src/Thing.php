<?php

namespace WConvert\Fixture;

final class Thing
{
    public function make(): object
    {
        $class = 'WConvert\Pro\Boot\BootGuard';

        return new $class();
    }
}
