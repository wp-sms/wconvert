<?php

namespace WConvert\Optin;

use WConvert\Storage\OptionStore;

defined('ABSPATH') || exit;

/**
 * The allowance the whole site shares — how often this device may be shown
 * **anything at all**.
 *
 * ============================================================================
 * THE SAME FOUR FIELDS, AT A SECOND SCOPE, AND A VETO OVER THE FIRST.
 * ============================================================================
 * A visitor who browses six pages can meet six different [[Optin]]s: WConvert
 * shows at most one overlay per page view and that guarantee resets on every
 * load, which is exactly what the support corpus records in merchants' own
 * words — *"it keeps popping up"*. The fix is not a new model. It is
 * {@see Frequency} asked once for the whole site (ADR 0047).
 *
 * So this holds a `Frequency` and nothing of its own. A translation layer
 * between the two scopes would be a second vocabulary with nothing asserting
 * the halves agree, and the payload is inlined verbatim into every matching
 * page.
 *
 * ============================================================================
 * ALL FOUR FIELDS DEFAULT **OFF**, WHICH IS THE OPPOSITE OF THE PER-OPTIN
 * DEFAULT, AND THE ASYMMETRY IS DELIBERATE.
 * ============================================================================
 * An Optin's own two switches default ON, because a visitor who closed
 * something said *stop showing me this* and honouring it costs the merchant
 * nothing they did not accept by putting a close button on it. Read at site
 * scope the same click would mean *stop showing me anything, for a week* —
 * a claim about what the visitor meant that they did not make, and one a
 * merchant who never asked for it would experience as the plugin having
 * stopped working.
 *
 * That is why the two switches are spelled in FULL on the way in
 * ({@see self::allowance()}): the engine reads an absent key as ON, so at this
 * scope an absent key has to be filled in as `false` before `Frequency` ever
 * sees it. And it is why {@see self::forPayload()} returns null for an
 * untouched site — an install that has asked for nothing carries no allowance
 * on any page and writes no record on any device, so shipping this changes
 * nothing about what a live site does.
 *
 * ============================================================================
 * STORAGE IS ONE WORDPRESS OPTION, THE WAY THE RETENTION PERIOD IS.
 * ============================================================================
 * A site-wide decision has no Optin to hang on, and the table-free alternative
 * the database rule asks to have considered is the right one here for the
 * reason {@see \WConvert\Retention\RetentionPeriod} gives: one small value for
 * the whole site, read on the enqueue path and written from one screen. Not
 * autoloaded, like everything else WConvert stores (ADR 0003).
 *
 * The *visitor's* half is not stored here at all. It is a reserved slot inside
 * the loader's one persistent key — `wcv1['site']`, a name no ULID can take —
 * so it costs no second read, no second write and no second consent call
 * (`resources/loader/src/state.ts`).
 *
 * @since 0.1.0
 */
final class SiteFrequency
{
    public const OPTION = 'wconvert_site_frequency';

    public function __construct(
        private readonly OptionStore $options,
    ) {
    }

    /**
     * The configured allowance, with **off** as what absence means.
     *
     * The two switches are filled in as `false` before {@see Frequency} reads
     * the array, because `Frequency` answers for the ENGINE's defaults and the
     * engine's default is on. Anything the option cannot be read as at all is
     * the same shipped default rather than a fatal: this is on the path every
     * uncached page view runs, and one hand-edited option must not take the
     * site down with it.
     */
    public function allowance(): Frequency
    {
        $stored = $this->options->get(self::OPTION, []);

        return self::atThisScope(is_array($stored) ? $stored : []);
    }

    /**
     * The allowance as an **authoring surface** reads it: all four fields,
     * every one of them spelled out.
     *
     * ========================================================================
     * THE OPTION IS NOT THE PAYLOAD, AND THIS IS THE ONE PLACE THAT MATTERS.
     * ========================================================================
     * {@see Frequency::toArray()} writes only what differs from the ENGINE's
     * defaults, so it drops a `true` and omits an unset number. That is
     * exactly right for the browser — an absent key and a stored `true` are
     * the same answer there, and only one of them costs bytes on every
     * matching page view — and exactly wrong on this side, twice over. At this
     * scope an absent switch means OFF, so storing `toArray()` verbatim would
     * silently lose a switch the merchant had just turned on; and a control
     * cannot draw a checkbox from a key that is not there.
     *
     * So the option holds this, the REST route answers with this, and neither
     * has to know which scope's silence it is reading. It costs a few words in
     * one option row that no page view reads.
     *
     * @return array{maxImpressions: int|null, cooldownDays: int|null, stopAfterDismiss: bool, stopAfterConversion: bool}
     */
    public function authored(): array
    {
        return self::spell($this->allowance());
    }

    /**
     * Store it.
     *
     * It takes the authored array rather than a {@see Frequency}, because
     * `Frequency::fromArray()` answers for the ENGINE: a caller building one
     * first would have turned both switches on before this ever saw it. The
     * scope's reading of absence is spelled once, in
     * {@see self::atThisScope()}, and every door goes through it.
     *
     * What is written is {@see self::authored()}'s shape, so the value that
     * goes in is the value that comes back. `true` still never reaches the
     * browser; {@see self::forPayload()} is where that is kept.
     *
     * @param array<string, mixed> $config
     */
    public function set(array $config): void
    {
        $this->options->set(self::OPTION, self::spell(self::atThisScope($config)));
    }

    /**
     * What the page carries, or **null where there is nothing to carry**.
     *
     * Null is the state every install ships in, and it is the whole of "an
     * upgrade changes nothing about what a live site does": no attribute on the
     * payload tag, no site allowance in the browser, no site record on the
     * visitor's device, and a decision byte-for-byte the one taken today.
     *
     * @return array<string, mixed>|null
     */
    public function forPayload(): ?array
    {
        $allowance = $this->allowance();

        return $allowance->stopsNothing() ? null : $allowance->toArray();
    }

    /**
     * One array, read with **this scope's defaults rather than the engine's**.
     *
     * ========================================================================
     * ONLY AN EXPLICIT YES IS A YES, AND A DEFAULT ALONE WOULD NOT SAY THAT.
     * ========================================================================
     * The single place the asymmetry lives. {@see Frequency::fromArray()}
     * answers for the engine, where an absent switch is ON and the test is
     * `!== false`; here an absent switch is OFF.
     *
     * Filling the gaps with a `+ ['stopAfterDismiss' => false]` default reads
     * as enough and is not: `+` leaves a key that is PRESENT alone, so a body
     * of `{"stopAfterDismiss": null}` — or `0`, or `"no"` — arrives intact and
     * the engine's `!== false` reads every one of them as **on**. Unreachable
     * from the card that ships, reachable from any other REST client, and it
     * would turn a site-wide cap on for a merchant who asked for nothing.
     *
     * So both switches are resolved to real booleans here. `filter_var` rather
     * than `=== true`, because a form-encoded body spells a tick `"1"` and a
     * merchant who ticked a box meant it.
     *
     * Everything else — what counts as a usable number, what a nonsensical one
     * drops to — is `Frequency`'s and is not re-derived.
     *
     * @param array<string, mixed> $config
     */
    private static function atThisScope(array $config): Frequency
    {
        return Frequency::fromArray([
            'maxImpressions' => $config['maxImpressions'] ?? null,
            'cooldownDays' => $config['cooldownDays'] ?? null,
            'stopAfterDismiss' => filter_var($config['stopAfterDismiss'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'stopAfterConversion' => filter_var($config['stopAfterConversion'] ?? false, FILTER_VALIDATE_BOOLEAN),
        ]);
    }

    /**
     * One allowance, as all four fields.
     *
     * @return array{maxImpressions: int|null, cooldownDays: int|null, stopAfterDismiss: bool, stopAfterConversion: bool}
     */
    private static function spell(Frequency $allowance): array
    {
        return [
            'maxImpressions' => $allowance->maxImpressions,
            'cooldownDays' => $allowance->cooldownDays,
            'stopAfterDismiss' => $allowance->stopAfterDismiss,
            'stopAfterConversion' => $allowance->stopAfterConversion,
        ];
    }
}
