<?php

namespace WConvert\Optin;

defined('ABSPATH') || exit;

final class Schedule
{
    private function __construct(
        public readonly ?string $startsAt = null,
        public readonly ?string $endsAt = null,
    ) {
    }

    /**
     * @param array<string, mixed> $config
     */
    public static function fromArray(array $config): self
    {
        $schedule = new self(
            self::wallTime($config['starts_at'] ?? null),
            self::wallTime($config['ends_at'] ?? null),
        );

        if ($schedule->isImpossible()) {
            throw new InvalidSchedule('An Optin\'s schedule must end after it starts.');
        }

        return $schedule;
    }

    /**
     * @param array<string, mixed> $config
     * @return array<string, int>
     */
    public static function windowIn(array $config, \DateTimeZone $siteZone): array
    {
        try {
            return self::fromArray($config)->resolve($siteZone);
        } catch (InvalidSchedule) {
            return [];
        }
    }

    public function isEmpty(): bool
    {
        return $this->startsAt === null && $this->endsAt === null;
    }

    /**
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

    public function isImpossible(): bool
    {
        return $this->startsAt !== null && $this->endsAt !== null && $this->endsAt <= $this->startsAt;
    }

    /**
     * @param mixed $value
     */
    private static function wallTime($value): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $wallTime = str_replace('T', ' ', substr(trim($value), 0, 16));
        $moment = \DateTimeImmutable::createFromFormat('!Y-m-d H:i', $wallTime);

        return $moment !== false && $moment->format('Y-m-d H:i') === $wallTime ? $wallTime : null;
    }

    /**
     * @return array<string, int>
     */
    public function resolve(\DateTimeZone $siteZone): array
    {
        $out = [];

        foreach (['starts_at' => $this->startsAt, 'ends_at' => $this->endsAt] as $key => $wallTime) {
            $instant = $wallTime === null ? null : self::instant($wallTime, $siteZone);

            if ($instant !== null) {
                $out[$key] = $instant;
            }
        }

        return $out;
    }

    /**
     * One authored wall time, on the site's clock, in milliseconds.
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
     * Null where the wall time cannot be read at all. {@see self::fromArray()}
     * has already dropped anything unparseable, so this arises only for a
     * hand-edited stored blob — and the reader's door must be total, because a
     * rebuild walks every published row.
     */
    private static function instant(string $wallTime, \DateTimeZone $siteZone): ?int
    {
        $moment = \DateTimeImmutable::createFromFormat('!Y-m-d H:i', $wallTime, $siteZone);

        return $moment === false ? null : $moment->getTimestamp() * 1000;
    }
}
