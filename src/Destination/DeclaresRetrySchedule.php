<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * A [[Destination]] type whose retries follow its own clock.
 *
 * **Optional, and the ESPs do not implement it.** They keep {@see PushJob}'s
 * five attempts, doubling from a minute, because a vendor's bad afternoon is
 * over in sixteen minutes or it is not a bad afternoon. A webhook's receiver is
 * a merchant's own Zap or n8n box, which is down for hours rather than minutes,
 * so it declares about a day instead (ADR 0148).
 *
 * The schedule is delays only. Jobs still carry ids and an attempt number and
 * nothing else, and the worker still re-reads everything per attempt.
 *
 * @since 0.1.0
 */
interface DeclaresRetrySchedule
{
    /**
     * Seconds to wait after each failed attempt, in order. Their count is the
     * number of RETRIES: six delays is seven attempts, then the Lead needs
     * attention and the manual resend takes over (ADR 0071).
     *
     * @return list<int>
     */
    public function retryDelays(): array;
}
