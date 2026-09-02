<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * A [[Schedule]] that was authored and cannot be one.
 *
 * ============================================================================
 * IT CARRIES A REASON, AND THE REASON IS NOT A SENTENCE.
 * ============================================================================
 * {@see Schedule} is pure and has no WordPress in it, so it cannot call
 * `__()` — and a merchant-facing sentence minted where `make-pot` cannot see
 * it is a sentence nobody can translate. So the RULE lives in the normaliser
 * and the WORDING lives at whatever surface is refusing: the REST route turns
 * this into a 400, and the second, non-REST author that ADR 0047 predicts will
 * turn the same reason into whatever its own screen says.
 *
 * Two reasons rather than one message, because they send a merchant to
 * different places — one to a value they typed, one to the pair.
 *
 * @since 0.1.0
 */
final class InvalidSchedule extends \DomainException
{
    /** A boundary was supplied and is not a date and time. */
    public const UNREADABLE = 'unreadable';

    /** Both boundaries are readable and no instant is between them. */
    public const BACKWARDS = 'backwards';

    /**
     * @param self::UNREADABLE|self::BACKWARDS $reason
     */
    public function __construct(
        public readonly string $reason,
        string $message,
    ) {
        parent::__construct($message);
    }
}
