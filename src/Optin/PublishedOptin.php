<?php

namespace WConvert\Optin;

use WConvert\Rules\Degradation;
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
     * **One id, one parse.** This is right for the capture route, which asks
     * about exactly one submission. A caller asking about a BATCH — the beacon
     * coalesces up to twenty events over one page view — parses the set once
     * with {@see self::fromSet()} and builds its own lookup from that, rather
     * than paying for the whole set per event on the route that fires on every
     * page view.
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
     * Every id in the set this install is actually SERVING, as a lookup.
     *
     * Beside {@see self::findInSet()} because it answers a related question
     * for a DIFFERENT number of ids, and the difference matters: `findInSet`
     * parses the whole set to answer about one, which is right for the capture
     * route. The beacon coalesces up to twenty events over one page view, so
     * asking that way would parse the set once per event, on the route that
     * fires on every page view.
     *
     * ========================================================================
     * "PUBLISHED" IS NOT THE SAME QUESTION AS "SERVED".
     * ========================================================================
     * A [[Suspended]] Optin is in the published set and is not on any page
     * this install serves, so it must not be countable either: ADR 0027 asks
     * for **no rows** rather than zero-valued ones, because a suspended Optin
     * contributing zeroes against a live denominator makes two periods
     * incomparable and a counter cannot be recomputed afterwards.
     *
     * Absence from the payload usually delivers that on its own. What it does
     * not cover is a page cached BEFORE the dependency went away, which still
     * carries the entry and whose loader will still beacon — so the same
     * question is asked again here, where the count would land.
     *
     * Keyed rather than a list so the caller tests membership with `isset`.
     * This is NOT the "second shape of the published set" ADR 0003 refuses: it
     * is derived per request from the option that was just read, and nothing
     * stores it.
     *
     * @param iterable<array<string, mixed>> $set
     * @return array<string, true>
     */
    public static function servableIdsIn(iterable $set, Degradation $degradation): array
    {
        $ids = [];

        foreach (self::fromSet($set) as $optin) {
            if ($degradation->suspendedBy($optin->rules()) === null) {
                $ids[$optin->id] = true;
            }
        }

        return $ids;
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
     * Both client axes, flat again — the shape the rule vocabulary reads.
     *
     * The partition happened at publish time and is what the browser is sent
     * (ADR 0005); questions asked ABOUT an Optin's rules rather than about
     * when each one fires are asked of all of them at once. The one asking is
     * {@see \WConvert\Rules\Degradation}, which resolves both axes together
     * because a substitution is a rule swap and kind is a fixed property of
     * the type.
     *
     * Here rather than at the caller, for this class's whole reason: nothing
     * downstream should be reaching into `$payload['triggers']` and spelling
     * an axis name for itself.
     *
     * @return list<array<string, mixed>>
     */
    public function rules(): array
    {
        $rules = [];

        foreach (['triggers', 'conditions'] as $axis) {
            foreach (is_array($this->payload[$axis] ?? null) ? $this->payload[$axis] : [] as $rule) {
                if (is_array($rule)) {
                    /** @var array<string, mixed> $rule */
                    $rules[] = $rule;
                }
            }
        }

        return $rules;
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
