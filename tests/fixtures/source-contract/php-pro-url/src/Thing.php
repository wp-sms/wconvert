<?php

namespace WConvert\Fixture;

final class Thing
{
    /**
     * Free renders `locked` Availability states and links to the Pro landing
     * page to do it (ADR 0015). That URL has a pro/ segment and is not an
     * import of anything.
     */
    public const UPGRADE_URL = 'https://wconvert.io/pro/';
}
