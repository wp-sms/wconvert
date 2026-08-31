<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * An Optin's allowance: how often this device may be shown it at all.
 *
 * ============================================================================
 * THE LOADER HAS HONOURED THIS SINCE #3. NOTHING HAS EVER WRITTEN IT.
 * ============================================================================
 * `resources/loader/src/frequency.ts` reads all four fields and
 * `resources/loader/src/types.ts` declares them, but no authoring surface has
 * ever produced one and no route has ever validated one — so `frequency`
 * reached the browser as unvalidated passthrough out of a config blob, and
 * every merchant Optin shipped uncapped. This is the shape that ends that:
 * {@see \WConvert\Rest\OptinController::normalizeConfig()} rounds the key
 * through it on the way in, exactly as it already rounds `targeting` through
 * {@see \WConvert\Targeting\Targeting}.
 *
 * **The shape is the loader's, not a second one.** Four fields, the same names
 * in the same casing, because the payload is inlined verbatim into every
 * matching page and a translation layer between the two would be a second
 * vocabulary with nothing asserting the halves agree.
 *
 * ============================================================================
 * WHY THIS IS A FILE AND NOT SIX LINES IN THE CONTROLLER.
 * ============================================================================
 * ADR 0047 specifies a site-wide allowance as *"the four fields Frequency
 * already has, held once for the whole site"*. A normaliser inlined in the
 * REST controller is a normaliser that gets rewritten the day that ships,
 * because the site-wide surface is not a REST controller — so the arithmetic
 * that decides what a valid allowance is lives in one pure place now, and the
 * second scope reuses it rather than re-deriving it.
 *
 * Pure, and with no WordPress in it, for the same reason
 * {@see \WConvert\Targeting\Targeting} has none: it is tested without an
 * install, and the option it normalises is read on every uncached page view.
 *
 * @since 0.1.0
 */
final class Frequency
{
    public function __construct(
        /** How many times this device may see it at all. Null is uncapped. */
        public readonly ?int $maxImpressions = null,
        /** Whole days between showings. Null is no cooldown. */
        public readonly ?int $cooldownDays = null,
        /**
         * Both default TRUE, and both record something the VISITOR did.
         *
         * Closing a popup and completing one are the two strongest "stop
         * showing me this" a visitor has, and `frequency.ts` tests `!== false`
         * on each — so the default is not a convention this class chose, it is
         * what the engine does with an absent key. Held as a plain `bool` with
         * that default rather than as a nullable, because "unset" and "true"
         * are not two states the engine can tell apart and holding them as two
         * would invite a surface to try.
         */
        public readonly bool $stopAfterDismiss = true,
        public readonly bool $stopAfterConversion = true,
    ) {
    }

    /**
     * @param array<string, mixed> $config
     */
    public static function fromArray(array $config): self
    {
        return new self(
            self::positive($config['maxImpressions'] ?? null),
            self::positive($config['cooldownDays'] ?? null),
            ($config['stopAfterDismiss'] ?? true) !== false,
            ($config['stopAfterConversion'] ?? true) !== false,
        );
    }

    /** Is this the default allowance — nothing capped and nothing turned off? */
    public function isEmpty(): bool
    {
        return $this->toArray() === [];
    }

    /**
     * Back to storage, with **only what differs from the engine's defaults**.
     *
     * `true` is never written. The payload is inlined into every matching page
     * against a 2KB budget (ADR 0014) and `frequency.ts` tests `!== false`, so
     * a stored `stopAfterDismiss: true` is bytes on every page view that
     * cannot change an answer. Only `false` travels.
     *
     * Empty means the whole key is dropped by the caller rather than stored as
     * `[]` — an empty object in the payload is the same bytes-with-no-reader
     * one line down.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $out = [];

        if ($this->maxImpressions !== null) {
            $out['maxImpressions'] = $this->maxImpressions;
        }

        if ($this->cooldownDays !== null) {
            $out['cooldownDays'] = $this->cooldownDays;
        }

        if (!$this->stopAfterDismiss) {
            $out['stopAfterDismiss'] = false;
        }

        if (!$this->stopAfterConversion) {
            $out['stopAfterConversion'] = false;
        }

        return $out;
    }

    /**
     * A count of things, or null.
     *
     * Zero and negatives are not smaller caps, they are nonsense: a
     * `maxImpressions` of 0 would mean an Optin that is published and can
     * never show, which is a state the merchant has no word for and the
     * inspector would have to explain. Dropped to null — uncapped — because
     * the alternative is refusing a save over a field the builder's own `min`
     * already keeps out of range.
     *
     * @param mixed $value
     */
    private static function positive($value): ?int
    {
        if (!is_numeric($value)) {
            return null;
        }

        $count = (int) $value;

        return $count > 0 ? $count : null;
    }
}
