<?php

namespace WConvert\Milestone;

defined('ABSPATH') || exit;

/**
 * The first time a merchant changed something a [[Playbook]] suggested: a day,
 * the Playbook, and which of its suggestions went first.
 *
 * **Three fields and no fourth.** There is no Optin id, no user id and no
 * before-and-after — none of which the signal needs, and every one of which
 * would turn a fact about the SITE into a fact about a person or a row
 * (ADR 0017). The Playbook is named because the whole point is which Goal's
 * defaults are wrong, and a part with no Playbook behind it cannot say.
 *
 * A **day** rather than a moment, like every other milestone and for the same
 * reason `wconvert_stats` keeps a `DATE`: nothing reads an hour-of-day here,
 * and a timestamp is precision that only ever narrows who could have done it.
 *
 * @since 0.1.0
 */
final class FirstEdit
{
    public function __construct(
        public readonly string $on,
        public readonly string $playbook,
        public readonly EditedPart $part,
    ) {
    }

    /**
     * A stored record, or **null where any part of it is missing or unknown**.
     *
     * Tolerant on the way out of storage the way every WConvert option is: a
     * `part` this build does not have a case for is read as no record at all
     * rather than as a broken one, which is what lets the set above change
     * without a migration.
     *
     * @param mixed $stored
     */
    public static function fromStored($stored): ?self
    {
        if (!is_array($stored)) {
            return null;
        }

        $on = $stored['on'] ?? null;
        $playbook = $stored['playbook'] ?? null;
        $part = EditedPart::tryFrom(is_string($stored['part'] ?? null) ? $stored['part'] : '');

        if (!is_string($on) || $on === '' || !is_string($playbook) || $playbook === '' || $part === null) {
            return null;
        }

        return new self($on, $playbook, $part);
    }

    /**
     * @return array{on: string, playbook: string, part: string}
     */
    public function toArray(): array
    {
        return ['on' => $this->on, 'playbook' => $this->playbook, 'part' => $this->part->value];
    }
}
