<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * A campaign was linked to an occasion that does not exist.
 *
 * Carries no sentence, for the reason {@see InvalidSchedule} gives: the rule
 * lives in {@see OccasionLink}, which has no WordPress in it, and the wording
 * lives at the REST route that refuses the save.
 */
final class InvalidOccasion extends \DomainException
{
    public function __construct(public readonly string $occasion)
    {
        parent::__construct('Unknown occasion: ' . $occasion);
    }
}
