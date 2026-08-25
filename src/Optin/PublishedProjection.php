<?php

namespace WConvert\Optin;

use WConvert\Rules\RuleVocabulary;

defined('ABSPATH') || exit;

/**
 * Rows in, published set out — pure (ADR 0003).
 *
 * This is also **publish time**, which is where ADR 0005 puts the one thing
 * PHP does with the two client axes: an Optin's flat rule list is split into
 * `triggers` and `conditions` here rather than by the loader on every page
 * view. Kind is a fixed property of the type, so the manifest already knows
 * the answer.
 *
 * The vocabulary is passed in rather than read here. It is the manifest, and
 * a projection that reads a file off disk is no longer pure — which is the
 * property that lets this be tested without a WordPress install.
 *
 * @since 0.1.0
 */
final class PublishedProjection
{
    /**
     * Keys that say where an Optin came from, and are read by nothing that
     * renders it.
     *
     * Both are ids into a registry the front end never consults: an Optin
     * takes a COPY of its [[Template]] and a COPY of its [[Playbook]]'s words,
     * so improving either entry restyles nothing and deleting either leaves
     * the Optin working. What is left for an id to do on the page is nothing
     * at all, and it is bytes on every page view.
     */
    private const PROVENANCE = ['template_id', 'playbook_id'];

    /**
     * @param iterable<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    public static function build(iterable $rows, RuleVocabulary $vocabulary): array
    {
        $set = [];

        foreach ($rows as $row) {
            $entry = self::project($row, $vocabulary);

            if ($entry !== null) {
                $set[] = $entry;
            }
        }

        return $set;
    }

    /**
     * Every reason an Optin is not in the published set, in one place.
     *
     * This list is what later tickets extend rather than fork: an Optin
     * holding a Condition marked `on_absence: suspend` that this install
     * cannot evaluate joins it (ADR 0027) — though from the enqueue filter
     * rather than from here, since suspension is computed against the live
     * registry and this projection is built at publish time.
     *
     * @param array<string, mixed> $row
     */
    private static function isExcluded(array $row): bool
    {
        // Not published, or unpublished since. `published_at` is the marker
        // rather than the presence of `published_config`: unpublishing keeps
        // the last live version so republishing is not a retype.
        if (($row['published_at'] ?? null) === null) {
            return true;
        }

        // Soft-deleted. An Optin is never hard-deleted, because analytics
        // interprets its counts by joining this table at read (ADR 0020), so
        // "deleted" has to mean something the front end honours on its own.
        return ($row['deleted_at'] ?? null) !== null;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>|null
     */
    private static function project(array $row, RuleVocabulary $vocabulary): ?array
    {
        if (self::isExcluded($row)) {
            return null;
        }

        $published = json_decode((string) ($row['published_config'] ?? ''), true);

        if (!is_array($published)) {
            return null;
        }

        $targeting = $published['targeting'] ?? [];
        unset($published['targeting']);

        // PROVENANCE IS STRIPPED. `template_id` and `playbook_id` record where
        // an Optin CAME FROM; neither is consulted at render time and neither
        // ever will be, because the Optin holds its own copy of both the
        // design and the words (ADR 0010, CONTEXT.md Playbook). ADR 0010 says
        // `template_id` "never appears in the payload" — until #27 that was a
        // claim rather than a fact, and it is paid for on every page view of
        // every matching page, against a 2KB budget.
        foreach (self::PROVENANCE as $key) {
            unset($published[$key]);
        }

        // The flat list is CONSUMED, not shipped beside its own partition:
        // two spellings of one rule set in one payload is a second source of
        // truth the loader would have to choose between, and bytes on every
        // page view.
        $rules = $published['rules'] ?? [];
        unset($published['rules']);

        // And the partition OVERWRITES rather than merges. `$published` is a
        // config blob, so it can carry a `triggers` key of its own — hand-
        // written, or left by an older shape — and PHP's `+` lets the LEFT
        // operand win, which would ship that instead and discard the real
        // answer. The manifest decides what the two axes hold; nothing in the
        // blob gets a vote.
        return [
            'id' => (string) ($row['id'] ?? ''),
            'targeting' => is_array($targeting) ? $targeting : [],
            // Both keys, always — including empty. The loader reads "no
            // triggers" as "never fires", which is ADR 0012's zero-trigger
            // loss stated rather than guessed at, and it can only read that
            // from a key that is present.
            'payload' => array_merge($published, $vocabulary->partition($rules)),
        ];
    }
}
