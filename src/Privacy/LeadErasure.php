<?php

namespace WConvert\Privacy;

use WConvert\Destination\DeliveryFailures;
use WConvert\Lead\Identifier;
use WConvert\Lead\LeadRepository;

defined('ABSPATH') || exit;

/**
 * Permanently remove every [[Lead]] that directly carries one identifier.
 *
 * This is deliberately NOT a person lookup. An email erasure matches the
 * `email` column and a phone erasure matches the `phone` column; neither walks
 * from one identifier to the other or treats the grouping view as identity
 * (ADR 0018, ADR 0021).
 *
 * Delivery failures are scrubbed with the rows. The ring is bounded at 200,
 * so resolving its referenced Leads before the delete keeps the cleanup exact
 * without loading every matching Lead id into memory.
 */
final class LeadErasure
{
    public function __construct(
        private readonly LeadRepository $leads,
        private readonly DeliveryFailures $failures,
    ) {
    }

    /**
     * @return array{identifier: string, removed: int}|null Null when the value is not a canonicalisable identifier.
     */
    public function erase(string $identifier): ?array
    {
        $canonical = self::canonical($identifier);

        if ($canonical === null) {
            return null;
        }

        $failureLeadIds = [];

        foreach (array_unique(array_column($this->failures->all(), 'lead')) as $leadId) {
            $lead = $this->leads->find((string) $leadId);

            if ($lead !== null && ($lead->email === $canonical || $lead->phone === $canonical)) {
                $failureLeadIds[] = $lead->id;
            }
        }

        $removed = $this->leads->eraseByIdentifier($canonical);
        $this->failures->forgetLeads($failureLeadIds);

        return ['identifier' => $canonical, 'removed' => $removed];
    }

    public static function canonical(string $identifier): ?string
    {
        return Identifier::email($identifier) ?? Identifier::phone($identifier);
    }
}
