<?php

namespace WConvert\Destination\Wsms;

defined('ABSPATH') || exit;

/**
 * A conflict that no read can resolve: WSMS's unique index says one of this
 * [[Lead]]'s identifiers is taken, and neither `findByEmail()` nor
 * `findByPhone()` can find the [[Contact]] holding it.
 *
 * Distinct from {@see ContactConflict}, which is an ordinary outcome —
 * success-with-existing — rather than a problem. This one is a contradiction
 * inside WSMS's own table, and the adapter has nothing to do about it. It goes
 * back on the queue as a retryable failure, which is free because `push()` is
 * idempotent (ADR 0008).
 *
 * @since 0.1.0
 */
final class UnresolvableConflict extends \RuntimeException
{
}
