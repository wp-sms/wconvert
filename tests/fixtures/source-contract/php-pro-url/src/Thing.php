<?php

namespace WConvert\Fixture;

final class Thing
{
    /**
     * Free renders `locked` Availability states and links to a Pro page to do
     * it (ADR 0015). A URL with a pro/ segment is not an import of anything.
     */
    public const UPGRADE_URL = 'https://wconvert.io/pro/';
}
