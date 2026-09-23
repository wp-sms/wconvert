<?php

namespace WConvert\Privacy;

use WConvert\Destination\DestinationRegistry;
use WConvert\Destination\DestinationRequirements;
use WConvert\Destination\DestinationStore;
use WConvert\Rest\RateLimit;
use WConvert\Rest\CaptureRateLimit;
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
     *   browser: array{key: string, local_storage_expiry_days: null, cookie_fallback: bool, cookie_fallback_days: int, contains_contact_details: bool, contains_visitor_identifier: bool, stores_ab_assignment: bool, reopen_session: string|null, content_unlock: string|null, cart_recovery: array{key: string, expires_with_cart_session: bool, contains_item_count: bool, contains_cart_total: bool, contains_contact_details: bool}|null},
     *   beacon_rate_limit_seconds: int,
     *   capture_rate_limit_seconds: int
     * }
     */
    public function summary(): array
    {
        return [
            'retention_days' => $this->retention->days(),
            'destinations' => $this->configuredDestinations(),
            'browser' => $this->browserStorage(),
            'beacon_rate_limit_seconds' => RateLimit::WINDOW,
            'capture_rate_limit_seconds' => CaptureRateLimit::WINDOW,
        ];
    }

    /**
     * @return array{key: string, local_storage_expiry_days: null, cookie_fallback: bool, cookie_fallback_days: int, contains_contact_details: bool, contains_visitor_identifier: bool, stores_ab_assignment: bool, reopen_session: string|null, content_unlock: string|null, cart_recovery: array{key: string, expires_with_cart_session: bool, contains_item_count: bool, contains_cart_total: bool, contains_contact_details: bool}|null}
     */
    private function browserStorage(): array
    {
        $browser = [
            'key' => 'wcv1',
            'display_session' => 'wcv_display_session_v1',
            'local_storage_expiry_days' => null,
            'cookie_fallback' => true,
            'cookie_fallback_days' => 365,
            'contains_contact_details' => false,
            'contains_visitor_identifier' => false,
            'stores_ab_assignment' => false,
            'reopen_session' => null,
            'content_unlock' => null,
            'cart_recovery' => null,
        ];

        /**
         * Premium modules add only storage they actually ship and can use.
         *
         * @param array<string, mixed> $browser
         */
        $filteredBrowser = apply_filters('wconvert_privacy_browser_storage', $browser);
        $filteredBrowser = is_array($filteredBrowser) ? $filteredBrowser : [];
        $cart = $filteredBrowser['cart_recovery'] ?? null;

        return [
            'key' => 'wcv1',
            'display_session' => 'wcv_display_session_v1',
            'local_storage_expiry_days' => null,
            'cookie_fallback' => true,
            'cookie_fallback_days' => 365,
            'contains_contact_details' => false,
            'contains_visitor_identifier' => false,
            'stores_ab_assignment' => ($filteredBrowser['stores_ab_assignment'] ?? null) === true,
            'content_unlock' => is_string($filteredBrowser['content_unlock'] ?? null) ? $filteredBrowser['content_unlock'] : null,
            'reopen_session' => is_string($filteredBrowser['reopen_session'] ?? null) ? $filteredBrowser['reopen_session'] : null,
            'cart_recovery' => is_array($cart) && is_string($cart['key'] ?? null) ? [
                'key' => $cart['key'],
                'expires_with_cart_session' => ($cart['expires_with_cart_session'] ?? null) === true,
                'contains_item_count' => ($cart['contains_item_count'] ?? null) === true,
                'contains_cart_total' => ($cart['contains_cart_total'] ?? null) === true,
                'contains_contact_details' => ($cart['contains_contact_details'] ?? null) === true,
            ] : null,
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
