<?php

namespace WConvert\Queue;

defined('ABSPATH') || exit;

/** Action Scheduler did not accept a requested job. */
final class QueueFailure extends \RuntimeException
{
}
