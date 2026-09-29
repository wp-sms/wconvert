<?php

namespace WConvert\Destination;

defined('ABSPATH') || exit;

/**
 * One configured [[Destination]] — a type, its settings, and the [[Connection]]
 * underneath it where its type has one.
 *
 * **Configured once, site-wide**, and it *includes whatever selects the target
 * inside the remote system* — the Mailchimp audience, the WSMS tags. That is
 * what collapses two concepts into one: two Optins feeding one audience
 * reference one Destination. Optional extra-answer maps live in Campaign
 * configuration and accepted submissions (ADR 0110).
 *
 * **It carries no delivery state and no health.** Those live in their own
 * non-autoloaded option, because two jobs completing at once lose an increment
 * to `update_option`'s read-modify-write — a race that is tolerable for
 * advisory health and would not be tolerable if it ate an admin's edit
 * (ADR 0008).
 *
 * @since 0.1.0
 */
final class Destination
{
    /**
     * @param string $type The {@see DestinationType} id — `wsms`, `mailchimp`.
     * @param string|null $connectionId The Connection holding its credentials, or null where the type needs none.
     * @param array<string, mixed> $settings
     */
    public function __construct(
        public readonly string $id,
        public readonly string $type,
        public readonly string $label,
        public readonly ?string $connectionId = null,
        public readonly array $settings = [],
    ) {
    }

    /**
     * @param array<string, mixed> $stored
     */
    public static function fromArray(string $id, array $stored): self
    {
        return new self(
            $id,
            (string) ($stored['type'] ?? ''),
            (string) ($stored['label'] ?? ''),
            isset($stored['connection']) && is_string($stored['connection']) && $stored['connection'] !== ''
                ? $stored['connection']
                : null,
            is_array($stored['settings'] ?? null) ? $stored['settings'] : [],
        );
    }

    /**
     * @return array{type: string, label: string, connection: string|null, settings: array<string, mixed>}
     */
    public function toArray(): array
    {
        return [
            'type' => $this->type,
            'label' => $this->label,
            'connection' => $this->connectionId,
            'settings' => $this->settings,
        ];
    }
}
