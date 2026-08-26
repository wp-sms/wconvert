<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * What one push did — three cases, and the third is the one that carries its
 * weight.
 *
 * `skipped` is load-bearing and deliberately distinct from `failed`: a [[Lead]]
 * with no email hitting an email-only [[Destination]] is skipped, not broken.
 * Collapsing the two would put a routine, expected outcome into
 * {@see DestinationHealth}'s failure count and light up an outage warning on a
 * site where nothing is wrong (ADR 0008).
 *
 * `success` never means "subscribed", and never has. It means the push landed
 * — WConvert has no opinion about who is subscribed, because it never reads
 * [[Contact]] state back (ADR 0007).
 *
 * @since 0.1.0
 */
enum PushOutcome: string
{
    case Success = 'success';

    /** Nothing to send. Not an error, and invisible to health. */
    case Skipped = 'skipped';

    case Failed = 'failed';
}
