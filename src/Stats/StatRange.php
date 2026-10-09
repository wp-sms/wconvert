<?php

namespace WConvert\Stats;

defined('ABSPATH') || exit;

/**
 * The window the analytics screen is reading — two `stat_date`s, inclusive at
 * both ends.
 *
 * ============================================================================
 * THE CALLER NEVER NAMES TODAY, AND THAT IS WHAT MAKES "TODAY" HONEST.
 * ============================================================================
 * The dashboard says "Today", and that has to mean the merchant's today
 * (ADR 0019). A browser asked for its own date would answer with the VISITOR's
 * day — a merchant in Tokyo checking their numbers from a hotel in Los Angeles
 * would be handed yesterday's window and told it was today's. So the REST
 * route takes a NUMBER OF DAYS or a named calendar month (ADR 0090), and the
 * one window built from two days, {@see self::between()}, takes days the
 * MERCHANT typed (ADR 0132) and is still capped at
 * {@see StatDay::today()}, computed on the server against the site's own
 * timezone. No constructor here accepts the browser's idea of today.
 *
 * **The arithmetic here is calendar arithmetic and has no timezone in it.**
 * Once {@see StatDay} has said which day it is, "twenty-nine days before that
 * day" is a question about a calendar rather than about a clock, and it is the
 * same answer in every zone. That is the whole reason it can be proven in a
 * suite whose `wp_timezone()` answers UTC: this file never asks.
 *
 * @since 0.1.0
 */
final class StatRange
{
    /**
     * The longest window the screen will read.
     *
     * `wconvert_stats` carries no secondary index and a date range across every
     * Optin is therefore a scan of it — booked at ~29k rows a year, which is a
     * read an admin screen can afford on demand (ADR 0019, ADR 0034). The cap
     * bounds returned rows, not the scan of the unindexed date predicate.
     * Comparisons read two such windows (ADR 0089).
     */
    public const MAX_DAYS = 366;

    /**
     * What the screen opens on. Long enough to show a trend, short enough that
     * a quiet Optin does not read as a dead one.
     */
    public const DEFAULT_DAYS = 30;

    /**
     * Why a window was refused, as exception codes, so the route can say it in
     * the merchant's language: this class has no WordPress in it to translate.
     */
    public const INVALID_MONTH = 1;
    public const INVALID_DAY = 2;
    public const REVERSED = 3;
    public const AFTER_TODAY = 4;
    public const TOO_LONG = 5;

    private function __construct(
        public readonly string $from,
        public readonly string $to,
        private readonly bool $empty = false,
    ) {
    }

    /**
     * The last `$days` days ending on `$today`, **including today itself**.
     *
     * `lastDays(1, …)` is today alone, which is what the merchant means by
     * "Today" — a window of one day rather than a window of none.
     *
     * `$today` is passed IN rather than read here, for the reason
     * {@see StatsRepository::increment()} takes its date the same way: "the
     * site's day" is a WordPress question, answered once at the request
     * boundary, so this class has no clock and nothing to stub.
     */
    public static function lastDays(int $days, string $today): self
    {
        // The route supplies the site day. Complete and previous windows
        // derive their boundaries here rather than accepting browser dates.

        $days = max(1, min($days, self::MAX_DAYS));

        return new self(self::daysBefore($today, $days - 1), $today);
    }

    /** Analytics comparisons exclude the in-progress site day. */
    public static function completeDays(int $days, string $today): self
    {
        return self::lastDays($days, self::daysBefore($today, 1));
    }

    /** A named month is stable in bookmarks; the site day still caps its end. */
    public static function calendarMonth(string $month, string $today): self
    {
        if (!preg_match('/^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/D', $month) || $month > substr($today, 0, 7)) {
            throw new \InvalidArgumentException('Choose a current or earlier calendar month.', self::INVALID_MONTH);
        }
        $from = $month . '-01';
        $end = (new \DateTimeImmutable($from, new \DateTimeZone('UTC')))->format('Y-m-t');
        $to = min($end, self::daysBefore($today, 1));
        // An empty first-day report has a valid date anchor, never yesterday's
        // counts disguised as this month's. days/covers/eachDay carry emptiness.
        return new self($from, max($from, $to), $to < $from);
    }

    /**
     * Two days the merchant chose, both counted (ADR 0132).
     *
     * **The days are typed, and today still comes from the server.** Ending
     * after `$today` is refused rather than clipped: a window that silently
     * ended earlier than asked is a window nobody chose. A range may END on
     * today — it is then live, and the route says so — and it may not be
     * longer than {@see self::MAX_DAYS}, the scan this table can afford.
     *
     * @throws \InvalidArgumentException with one of this class's codes.
     */
    public static function between(string $from, string $to, string $today): self
    {
        if (!self::isDay($from) || !self::isDay($to)) {
            throw new \InvalidArgumentException('Choose two calendar days.', self::INVALID_DAY);
        }
        if ($from > $to) {
            throw new \InvalidArgumentException('The first day comes after the last.', self::REVERSED);
        }
        if ($to > $today) {
            throw new \InvalidArgumentException('The last day cannot be after today.', self::AFTER_TODAY);
        }
        $range = new self($from, $to);
        if ($range->days() > self::MAX_DAYS) {
            throw new \InvalidArgumentException('Choose a shorter range.', self::TOO_LONG);
        }

        return $range;
    }

    /**
     * The same number of days immediately before — for a rolling window, a
     * month and a custom range alike (ADR 0089).
     */
    public function previous(): self
    {
        return self::lastDays($this->days(), self::daysBefore($this->from, 1));
    }

    /** How many days the window covers, both ends counted. */
    public function days(): int
    {
        if ($this->empty) return 0;
        $from = new \DateTimeImmutable($this->from, new \DateTimeZone('UTC'));
        $to = new \DateTimeImmutable($this->to, new \DateTimeZone('UTC'));

        return (int) $from->diff($to)->days + 1;
    }

    /**
     * Every day in the window, in order.
     *
     * The dashboard seeds its series with these so that a day nothing happened
     * on reports **0 rather than being absent**. A gap in a series reads as
     * missing data, and the quietest days are exactly the ones a merchant is
     * looking for.
     *
     * @return list<string>
     */
    public function eachDay(): array
    {
        $days = [];
        $day = new \DateTimeImmutable($this->from, new \DateTimeZone('UTC'));

        for ($i = 0, $count = $this->days(); $i < $count; $i++) {
            $days[] = $day->format(StatDay::FORMAT);
            $day = $day->modify('+1 day');
        }

        return $days;
    }

    /** Whether a `stat_date` falls inside the window. */
    public function covers(string $day): bool
    {
        return !$this->empty && $day >= $this->from && $day <= $this->to;
    }

    /** A real `Y-m-d` calendar day: the pattern alone would accept February 31. */
    private static function isDay(string $day): bool
    {
        return preg_match('/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/D', $day, $part) === 1
            && checkdate((int) $part[2], (int) $part[3], (int) $part[1]);
    }

    /**
     * `$days` days before `$day`, on the calendar.
     *
     * UTC is named explicitly and means nothing: both ends are bare dates, so
     * the zone only decides which midnight the arithmetic happens at and every
     * zone gives the same answer. Naming one keeps PHP from reaching for the
     * `date_default_timezone_get()` of whatever server this runs on, which is
     * the one way this could differ between two installs.
     */
    private static function daysBefore(string $day, int $days): string
    {
        return (new \DateTimeImmutable($day, new \DateTimeZone('UTC')))
            ->modify("-{$days} days")
            ->format(StatDay::FORMAT);
    }
}
