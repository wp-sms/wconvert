<?php

namespace WConvert\Optin;

use WConvert\Targeting\Targeting;

defined('ABSPATH') || exit;

/**
 * One entry of the published set, parsed.
 *
 * The set is stored as plain arrays because that is what a WordPress option
 * is. This is what the front-end read path works in instead: parsed once per
 * request, in one place, so nothing downstream reaches into
 * `$projection['targeting']['include'][0]['type']` and spells a rule type as a
 * string literal the manifest parity test cannot see (ADR 0005).
 *
 * @since 0.1.0
 */
final class PublishedOptin
{
    /**
     * @param array<string, mixed> $payload What the browser receives, targeting already removed.
     */
    public function __construct(
        public readonly string $id,
        public readonly Targeting $targeting,
        public readonly array $payload = [],
    ) {
    }

    /**
     * @param iterable<array<string, mixed>> $set
     * @return list<self>
     */
    public static function fromSet(iterable $set): array
    {
        $optins = [];

        foreach ($set as $projection) {
            $optin = self::fromProjection($projection);

            if ($optin !== null) {
                $optins[] = $optin;
            }
        }

        return $optins;
    }

    /**
     * One entry of the set, by id — or null where it is not in it.
     *
     * Beside {@see self::fromSet()} because it is the same act narrowed: the
     * set is stored as plain arrays, so finding one means parsing, and the
     * parse belongs here rather than at a caller that would then be reaching
     * into `$projection['id']` itself (ADR 0005).
     *
     * The scan is linear over an option the front end already reads whole on
     * every uncached page view; a keyed lookup would be a second shape of the
     * published set to keep in step, which is exactly what ADR 0003 refuses.
     *
     * @param iterable<array<string, mixed>> $set
     */
    public static function findInSet(iterable $set, string $id): ?self
    {
        if ($id === '') {
            return null;
        }

        foreach (self::fromSet($set) as $optin) {
            if ($optin->id === $id) {
                return $optin;
            }
        }

        return null;
    }

    /**
     * @param array<string, mixed> $projection
     */
    public static function fromProjection(array $projection): ?self
    {
        $id = (string) ($projection['id'] ?? '');

        // An entry with no id cannot be beaconed against, so it is not an
        // Optin — it is a corrupted option, and dropping it is the only thing
        // that leaves the page working.
        if ($id === '') {
            return null;
        }

        $targeting = $projection['targeting'] ?? [];
        $payload = $projection['payload'] ?? [];

        return new self(
            $id,
            Targeting::fromArray(is_array($targeting) ? $targeting : []),
            is_array($payload) ? $payload : [],
        );
    }

    /**
     * The entry as it travels to the browser.
     *
     * @return array<string, mixed>
     */
    public function toPayloadEntry(): array
    {
        // Targeting is STRIPPED, not shipped. It was answered on the server;
        // sending it would pay for it twice and hand the browser a rule it has
        // no reason to be able to re-evaluate (ADR 0005).
        return ['id' => $this->id] + $this->payload;
    }
}
