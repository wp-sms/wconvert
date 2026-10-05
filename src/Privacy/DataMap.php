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
        private readonly ?\WConvert\Optin\OptinRepository $optins = null,
        private readonly ?\WConvert\Protection\Settings $protection = null,
    ) {
    }

    /**
     * @return array{
     *   analytics_integration: array{configured: bool, route: string, consent: string}|null,
     *   retention_days: int|null,
     *   destinations: list<array{id: string, label: string, type: string, type_label: string, fields: list<string>|null}>,
     *   browser: array{additional: list<string>, key: string, local_storage_expiry_days: null, cookie_fallback: bool, cookie_fallback_days: int, contains_contact_details: bool, contains_visitor_identifier: bool, stores_ab_assignment: bool, reopen_session: string|null, content_unlock: string|null, cart_recovery: array{key: string, expires_with_cart_session: bool, contains_item_count: bool, contains_cart_total: bool, contains_contact_details: bool}|null},
     *   product_activity_retention_days: int|null,
     *   beacon_rate_limit_seconds: int,
     *   protection_provider: string,
     *   resource_send_limit_seconds: int,
     *   capture_rate_limit_seconds: int
     * }
     */
    public function summary(): array
    {
        return [
            'analytics_integration' => apply_filters('wconvert_analytics_privacy', null),
            'retention_days' => $this->retention->days(),
            'destinations' => $this->configuredDestinations(),
            'browser' => $this->browserStorage(),
            // Disclosed where product activity can be recorded, and where a
            // removed module left retained rows behind (ADR 0127).
            'product_activity_retention_days' => \WConvert\Template\CommerceSupport::productModuleActive() || \WConvert\Stats\ProductStats::tracked() ? \WConvert\Stats\ProductStats::RETENTION_DAYS : null,
            'beacon_rate_limit_seconds' => RateLimit::WINDOW,
            'capture_rate_limit_seconds' => CaptureRateLimit::WINDOW,
            'protection_provider' => $this->protection?->read()['provider'] ?? 'none',
            'resource_send_limit_seconds' => \WConvert\Protection\ResourceSendGuard::WINDOW,
        ];
    }

    /**
     * @return array{additional: list<string>, key: string, local_storage_expiry_days: null, cookie_fallback: bool, cookie_fallback_days: int, contains_contact_details: bool, contains_visitor_identifier: bool, stores_ab_assignment: bool, reopen_session: string|null, content_unlock: string|null, cart_recovery: array{key: string, expires_with_cart_session: bool, contains_item_count: bool, contains_cart_total: bool, contains_contact_details: bool}|null}
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
            'additional' => array_values(array_filter(is_array($filteredBrowser['additional'] ?? null) ? $filteredBrowser['additional'] : [], 'is_string')),
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
        $published = $this->optins?->publishedConfigs() ?? [];

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

                foreach ($published as $config) {
                    if (!is_array($config)) continue;
                    foreach ($config['integration_mappings'] ?? [] as $byDestination) {
                        if (is_array($byDestination) && !empty($byDestination[$destination->id])) {
                            $fields[] = 'mapped form/quiz answers';
                        }
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
