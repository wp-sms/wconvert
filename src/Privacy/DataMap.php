<?php

namespace WConvert\Privacy;

use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationRequirements;
use WConvert\Destination\DestinationStore;
use WConvert\Rest\RateLimit;
use WConvert\Retention\RetentionPeriod;

defined('ABSPATH') || exit;

/**
 * The privacy facts this install can prove from its current configuration.
 *
 * Presentations deliberately live elsewhere: the admin turns these facts into
 * merchant guidance and {@see PolicyText} turns them into suggested visitor
 * wording. Keeping the facts here stops those two surfaces disagreeing about
 * retention or configured [[Destination]]s without making either surface the
 * other's API.
 *
 * @since 0.1.0
 */
final class DataMap
{
    public function __construct(
        private readonly RetentionPeriod $retention,
        private readonly DestinationStore $destinations,
        private readonly DestinationRegistry $types,
    ) {
    }

    /**
     * @return array{
     *   retention_days: int|null,
     *   destinations: list<array{id: string, label: string, type: string, type_label: string, fields: list<string>|null}>,
     *   browser: array{key: string, local_storage_expiry_days: null, cookie_fallback: bool, cookie_fallback_days: int, contains_contact_details: bool, contains_visitor_identifier: bool},
     *   beacon_rate_limit_seconds: int
     * }
     */
    public function summary(): array
    {
        return [
            'retention_days' => $this->retention->days(),
            'destinations' => $this->configuredDestinations(),
            'browser' => [
                'key' => 'wcv1',
                'local_storage_expiry_days' => null,
                'cookie_fallback' => true,
                'cookie_fallback_days' => 365,
                'contains_contact_details' => false,
                'contains_visitor_identifier' => false,
            ],
            'beacon_rate_limit_seconds' => RateLimit::WINDOW,
        ];
    }

    /**
     * The routes that can receive a copy, with no connection or provider
     * settings. An unregistered type is retained with unknown fields rather
     * than disappearing from the map: unavailable code does not make an
     * already configured data flow cease to deserve review.
     *
     * @return list<array{id: string, label: string, type: string, type_label: string, fields: list<string>|null}>
     */
    private function configuredDestinations(): array
    {
        $rows = [];

        foreach ($this->destinations->all() as $destination) {
            $type = $this->types->find($destination->type);
            $fields = null;

            if ($type !== null) {
                $requirements = $type->requirements();
                $fields = $requirements->fields;

                foreach ($requirements->mappedFields as $field => $mapping) {
                    if (DestinationRequirements::text($destination->settings[$mapping['setting']] ?? null) !== '') {
                        $fields[] = $field;
                    }
                }

                $fields = array_values(array_unique($fields));
            }

            $rows[] = [
                'id' => $destination->id,
                'label' => $destination->label,
                'type' => $destination->type,
                'type_label' => $type?->label() ?? $destination->type,
                'fields' => $fields,
            ];
        }

        return $rows;
    }
}
