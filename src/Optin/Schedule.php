<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

/**
 * *When* an [[Optin]] runs at all — the window the merchant scheduled.
 *
 * ============================================================================
 * A WALL TIME IN, AN INSTANT OUT, AND ONE CONVERTER BETWEEN THEM.
 * ============================================================================
 * What is STORED is the local date and time the merchant typed —
 * `2026-11-27 09:00`, with no zone on it — because that is the only thing they
 * can reason about. What the browser RECEIVES is one absolute instant in
 * milliseconds, resolved by {@see self::resolve()} against the site's zone
 * every time the published set is rebuilt.
 *
 * Both directions of that are load-bearing. Freezing the instant at publish
 * would leave every schedule an hour out the day a merchant corrected their
 * site's timezone, with nothing on any screen to say why; and sending the
 * browser a wall time would make one schedule mean a different moment in every
 * visitor's browser, because the visitor's clock is not the site's clock
 * (ADR 0050).
 *
 * ============================================================================
 * WHY THIS IS A FILE AND NOT SIX LINES IN THE CONTROLLER.
 * ============================================================================
 * Beside {@see Frequency}, and for its reason. ADR 0047's amendment records
 * what the shortcut cost: `frequency` and `priority` reached the browser as
 * unvalidated passthrough out of a config blob, every merchant Optin shipped
 * uncapped and unprioritised, and nobody noticed until the rules panel landed.
 * A schedule is the same shape of value with the same second, non-REST author
 * coming — a wall time is authored, and nothing about authoring one is HTTP.
 *
 * Pure, and with no WordPress in it, for the reason
 * {@see \WConvert\Stats\StatDay} gives: the bootstrap answers `wp_timezone()`
 * as though every site were on UTC, so a seam built on it could not tell the
 * site's zone from UTC's and would pass just as happily against code that read
 * the wrong one. The zone is an argument; `bin/verify-schedule.php` is where
 * the one line that ASKS WordPress for it is proven.
 *
 * ============================================================================
 * TWO DOORS, AND THE DIFFERENCE BETWEEN THEM IS THE DESIGN.
 * ============================================================================
 * {@see self::fromArray()} is the AUTHOR's and it REFUSES. {@see
 * self::windowIn()} is the READER's and it is TOTAL. The same asymmetry
 * {@see \WConvert\Goal\Goal}'s `from` and `tryFrom` have where
 * {@see PublishedOptin} parses a stored option: validating an authored value
 * and parsing one that was validated years ago are different jobs, and a
 * rebuild that walks every published row must not be able to fatal the option
 * every page view reads.
 *
 * @since 0.1.0
 */
final class Schedule
{
    /**
     * The one spelling of a stored wall time. A MySQL `DATETIME` minus its
     * seconds, which is the precision an `<input type="datetime-local">`
     * offers and the precision a campaign is scheduled at.
     */
    public const FORMAT = 'Y-m-d H:i';

    /**
     * Private, so the canonical form is an INVARIANT rather than a habit.
     *
     * Both fields are either null or a string in {@see self::FORMAT}, because
     * the only ways in are the two doors below. That is what lets
     * {@see self::isImpossible()} compare them as strings and
     * {@see self::resolve()} parse them without a second opinion.
     */
    private function __construct(
        /** The local wall time it starts, or null for no start. */
        public readonly ?string $startsAt = null,
        /** The local wall time it ends, or null for no end. */
        public readonly ?string $endsAt = null,
    ) {
    }

    /**
     * The AUTHOR's door: what a merchant, a REST body or any future surface
     * gets. **It refuses rather than repairs.**
     *
     * ========================================================================
     * ABSENT IS A SCHEDULE. SUPPLIED-AND-UNREADABLE IS A REFUSAL.
     * ========================================================================
     * This is where it parts company with {@see Frequency}, which drops a
     * nonsensical count to null "because the alternative is refusing a save
     * over a field the builder's own `min` already keeps out of range". That
     * reasoning does not transfer, and the difference is what the two silences
     * MEAN: a `maxImpressions` of 0 and no cap at all are the same answer to
     * the engine, but a dropped `ends_at` is a **sale that never finishes** —
     * the *"it keeps popping up"* complaint this whole feature exists to
     * answer — and a dropped `starts_at` is one that can never show. Neither
     * is a decision the merchant made.
     *
     * So there are two refusals here and they are the same harm reached two
     * ways: a boundary that was supplied and cannot be read, and a pair that
     * cannot both be true. An ABSENT boundary is neither — "from Friday,
     * forever" and "from now until Friday" are things merchants mean, and an
     * emptied box is how they say one.
     *
     * @param array<string, mixed> $config
     * @throws InvalidSchedule
     */
    public static function fromArray(array $config): self
    {
        foreach (['starts_at', 'ends_at'] as $key) {
            $value = $config[$key] ?? null;

            // Null and the empty string are the merchant saying "no
            // boundary", which is a thing they mean. Anything else was
            // supplied, so it has to be readable.
            if ($value !== null && $value !== '' && self::wallTime($value) === null) {
                throw new InvalidSchedule(
                    InvalidSchedule::UNREADABLE,
                    "An Optin's {$key} is not a date and time."
                );
            }
        }

        $schedule = self::parse($config);

        if ($schedule->isImpossible()) {
            throw new InvalidSchedule(
                InvalidSchedule::BACKWARDS,
                "An Optin's schedule has to end after it starts."
            );
        }

        return $schedule;
    }

    /**
     * The READER's door: the stored blob, as the instants the browser gets.
     *
     * ========================================================================
     * TOTAL, AND IT FAILS SHUT.
     * ========================================================================
     * `PublishedProjection` calls this for every published row on every
     * rebuild, so it cannot throw: a single hand-edited blob would otherwise
     * fatal the one option every uncached page view reads.
     *
     * **An impossible pair is shipped rather than dropped, and the direction
     * is the whole point.** The loader's window is half-open —
     * `starts_at <= now < ends_at` — so a window that ends before it starts
     * contains no instant and the Optin never shows. Dropping it instead would
     * read as *never scheduled* and show a finished sale forever, which is the
     * failure this feature exists to prevent. It is the same fail-shut rule
     * `decide.ts` gives a rule that cannot answer.
     *
     * A boundary that cannot be READ at all is the one case that widens, and
     * only because there is nothing honest to ship in its place: inventing an
     * instant is asserting a schedule nobody authored. It cannot arise through
     * any supported route, because {@see self::fromArray()} refuses one at the
     * write.
     *
     * @param array<string, mixed> $config
     * @return array<string, int>
     */
    public static function windowIn(array $config, \DateTimeZone $siteZone): array
    {
        return self::parse($config)->resolve($siteZone);
    }

    /** Nothing scheduled at all, which is most Optins. */
    public function isEmpty(): bool
    {
        return $this->startsAt === null && $this->endsAt === null;
    }

    /**
     * A window no instant is inside.
     *
     * Compared as STRINGS, which is exact rather than lazy: both are canonical
     * `Y-m-d H:i` in the SAME zone, so lexicographic order is chronological
     * order and no parsing is needed to know the pair is backwards.
     *
     * Equal is impossible too, and that is a decision rather than an
     * off-by-one. The window is half-open, so a window that ends where it
     * starts contains no instant — an Optin that is published and can never
     * show, which is the state {@see Frequency} refuses a `maxImpressions` of
     * 0 for.
     *
     * The one case this reads as backwards while the instants disagree is a
     * pair straddling autumn's repeated hour, where two wall times an hour
     * apart resolve to the same or inverted instants. Refusing it costs a
     * merchant a one-minute window on one night a year and is the safe
     * direction.
     */
    public function isImpossible(): bool
    {
        return $this->startsAt !== null && $this->endsAt !== null && $this->endsAt <= $this->startsAt;
    }

    /**
     * Back to storage, as the wall times the merchant typed.
     *
     * An absent boundary is an absent KEY rather than a stored null: the
     * payload is inlined into every matching page against a 2KB budget
     * (ADR 0014), and the projection reads "no key" as "no boundary" already.
     *
     * @return array<string, string>
     */
    public function toArray(): array
    {
        $out = [];

        if ($this->startsAt !== null) {
            $out['starts_at'] = $this->startsAt;
        }

        if ($this->endsAt !== null) {
            $out['ends_at'] = $this->endsAt;
        }

        return $out;
    }

    /**
     * The window as absolute instants, in milliseconds.
     *
     * Milliseconds because `Date.now()` is what compares them, and a
     * conversion in the browser is a conversion that can be forgotten. Every
     * PHP caller that needs seconds divides once, where it reads them back
     * ({@see \WConvert\Frontend\InspectorSchedules}).
     *
     * @return array<string, int>
     */
    public function resolve(\DateTimeZone $siteZone): array
    {
        $out = [];

        foreach ($this->toArray() as $key => $wallTime) {
            $instant = self::instant($wallTime, $siteZone);

            if ($instant !== null) {
                $out[$key] = $instant;
            }
        }

        return $out;
    }

    /**
     * Both boundaries, read as far as they can be. Never throws.
     *
     * @param array<string, mixed> $config
     */
    private static function parse(array $config): self
    {
        return new self(
            self::wallTime($config['starts_at'] ?? null),
            self::wallTime($config['ends_at'] ?? null),
        );
    }

    /**
     * One authored value as a canonical wall time, or null where it is not one.
     *
     * The control is an `<input type="datetime-local">`, whose value carries a
     * `T` and may carry seconds; one spelling is stored, because the
     * projection re-parses it on every rebuild and two spellings would be two
     * parses of one fact.
     *
     * **The round trip is the validation.** PHP's parser ROLLS OVER rather
     * than refusing — a 13th month becomes January of the next year, a 29th
     * hour becomes 05:00 tomorrow — so comparing the formatted result against
     * what went in is what tells a date apart from a date nobody authored.
     *
     * @param mixed $value
     */
    private static function wallTime($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $wallTime = str_replace('T', ' ', substr(trim($value), 0, 16));
        $moment = \DateTimeImmutable::createFromFormat('!' . self::FORMAT, $wallTime);

        return $moment !== false && $moment->format(self::FORMAT) === $wallTime ? $wallTime : null;
    }

    /**
     * One canonical wall time, on the site's clock, in milliseconds.
     *
     * ========================================================================
     * THE ZONE DOES THE WORK, AND THAT IS THE WHOLE OF IT.
     * ========================================================================
     * `DateTimeImmutable` applies the offset **in force at that wall time**,
     * out of the zone's own history — so a campaign authored for a date on the
     * other side of a daylight-saving transition resolves against the offset
     * that will actually be in force then. The implementation to resist is
     * "read the site's current offset and add it", which is right for most of
     * the year and an hour wrong for the rest of it.
     *
     * Two wall times a zone cannot answer cleanly, both booked knowingly and
     * both PHP's own reading:
     *
     * - **A time that never happens.** Spring forward skips an hour, so 02:30
     *   on that date does not exist and resolves to 03:30. A campaign starting
     *   an hour later than typed, once a year, is the harmless direction.
     * - **A time that happens twice.** Autumn's fall back repeats an hour, and
     *   the FIRST occurrence wins. A campaign that starts an hour earlier than
     *   the other reading, once a year.
     *
     * Null only for a wall time this cannot read, which {@see self::wallTime()}
     * has already excluded — kept because {@see self::windowIn()} must be
     * total and a `false` from the parser is not something to assert away.
     */
    private static function instant(string $wallTime, \DateTimeZone $siteZone): ?int
    {
        $moment = \DateTimeImmutable::createFromFormat('!' . self::FORMAT, $wallTime, $siteZone);

        return $moment === false ? null : $moment->getTimestamp() * 1000;
    }
}
