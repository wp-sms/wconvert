<?php

namespace WConvert\Playbook;

defined('ABSPATH') || exit;

/** Editorial recommendations, not restrictions on a Goal or a reusable design. */
final class FlagshipCollection
{
    /** @var array<string, list<string>> */
    public const GROUPS = [
        'stores' => ['welcome-discount', 'coupon-ticket', 'sale-announcement', 'cart-straight-away'],
        'publishers' => ['read-to-the-end', 'article-end-newsletter', 'guide-download', 'reading-recommendation'],
        'services' => ['request-a-callback', 'request-a-quote', 'consultation-invitation', 'launch-checklist'],
    ];

    public static function recommendation(string $id): ?string
    {
        foreach (self::GROUPS as $audience => $ids) {
            if (in_array($id, $ids, true)) {
                return match ($audience) {
                    'stores' => __('Recommended for stores', 'wconvert'),
                    'publishers' => __('Recommended for publishers', 'wconvert'),
                    'services' => __('Recommended for services', 'wconvert'),
                };
            }
        }

        return null;
    }

    /**
     * Put recommendations first within the chosen Goal. PHP's stable sort
     * preserves the relative order of all other bundled and extension entries.
     *
     * @param list<Playbook> $playbooks
     * @return list<Playbook>
     */
    public static function prioritize(array $playbooks): array
    {
        $ranks = array_flip(array_merge(...array_values(self::GROUPS)));
        usort($playbooks, static fn (Playbook $a, Playbook $b): int =>
            ($ranks[$a->id] ?? PHP_INT_MAX) <=> ($ranks[$b->id] ?? PHP_INT_MAX));

        return $playbooks;
    }
}
