<?php

namespace WConvert\Milestone;

use WConvert\Optin\Optin;
use WConvert\Template\TemplateVocabulary;

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
     * The first override in one edit, or **null where the merchant changed
     * nothing a [[Playbook]] suggested**.
     *
     * ========================================================================
     * IT TAKES THE TWO OPTINS, BECAUSE EVERY FIELD IT READS IS THEIRS.
     * ========================================================================
     * This lived in {@see \WConvert\Rest\OptinController} and read four
     * fields off two Optins and nothing of the controller's own, which is the
     * shape that belongs on the data it envies. What is left at the route is
     * the decision about WHEN to ask — after a save that actually happened —
     * which is genuinely the route's.
     *
     * **Only where the Optin came from a Playbook.** `playbook_id` is
     * provenance and prefill is the only thing that writes it (ADR 0010,
     * CONTEXT.md, Playbook), so an Optin started from scratch has no
     * suggestion to have overridden — and a first edit recorded against no
     * Playbook could not say which [[Goal]]'s defaults it was evidence about,
     * which is the whole of what this milestone is for.
     *
     * It is read from the Optin as it stood BEFORE: that is what the merchant
     * was handed, and a request carrying a different `playbook_id` is not the
     * merchant having changed one.
     *
     * `$on` is passed in rather than read here, for the reason
     * {@see \WConvert\Stats\StatsRepository::increment()} takes its date the
     * same way — "the site's day" is a WordPress question, answered once at
     * the request boundary, so this class has no clock and nothing to stub.
     */
    public static function between(
        Optin $before,
        Optin $after,
        TemplateVocabulary $vocabulary,
        string $on
    ): ?self {
        $playbook = $before->config['playbook_id'] ?? null;

        if (!is_string($playbook) || $playbook === '') {
            return null;
        }

        $part = EditedPart::firstChangedBetween(
            $before->config,
            $after->config,
            $before->goal,
            $after->goal,
            $vocabulary
        );

        return $part === null ? null : new self($on, $playbook, $part);
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
