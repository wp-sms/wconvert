<?php

namespace WConvert\Agent;

use WConvert\Rest\Routes;

defined('ABSPATH') || exit;

/** The capability every WConvert screen asks for, asked of the agent's user. */
trait ManagersOnly
{
    /** @param array<string, mixed> $input */
    public function permitted(array $input): bool
    {
        return Routes::canManage();
    }
}
