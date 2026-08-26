<?php

namespace WConvert\Destination\Wsms;

defined('ABSPATH') || exit;

/**
 * A write that collided with a [[Contact]] that already exists — WSMS's
 * `ConflictException`, translated at the boundary.
 *
 * Translated rather than caught by its own name, because WConvert runs
 * Standalone: a `catch (\WSms\Exception\ConflictException $e)` is a reference
 * to a class that is absent on most installs, and the adapter has to be
 * readable — and testable — on a site with no WSMS at all.
 *
 * It is not an error in the adapter's own terms. **A conflict is
 * success-with-existing**: the Contact the write collided with is the Contact
 * this Lead was going to become, and first match wins with nothing merged
 * (ADR 0022).
 *
 * @since 0.1.0
 */
final class ContactConflict extends \RuntimeException
{
}
