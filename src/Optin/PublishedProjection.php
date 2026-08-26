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
     * Keys the browser is never sent, because nothing that renders an Optin
     * reads them — and the payload is inlined into every matching page against
     * a 2KB budget.
     *
     * **`template_id` and `playbook_id` are provenance.** Both are ids into a
     * registry the front end never consults: an Optin takes a COPY of its
     * [[Template]] and a COPY of its [[Playbook]]'s words, so improving either
     * entry restyles nothing and deleting either leaves the Optin working.
     * There is nothing left for an id to do on the page.
     *
     * **`destination_hint` is an authoring note.** It names [[Destination]]
     * *types* and the [[Lead]] fields a Playbook wanted, for the builder to
     * act on — and prefill never binds a Destination invisibly, so it is not
     * even a decision yet. The capture path re-reads everything about the form
     * from the server's own published copy and trusts the client for nothing
     * but the values a person typed (ADR 0004), so a hint on the page is bytes
     * with no reader.
     */
    private const NOT_SHIPPED = ['template_id', 'playbook_id', 'destination_hint'];

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

        // ADMIN-ONLY KEYS ARE STRIPPED. Provenance records where an Optin CAME
        // FROM and the destination hint records what its [[Playbook]] wanted;
        // neither is consulted at render time and neither ever will be, because
        // the Optin holds its own copy of the design and the words (ADR 0010,
        // CONTEXT.md Playbook). ADR 0010 says `template_id` "never appears in
        // the payload" — until #27 that was a claim rather than a fact, and it
        // is paid for on every page view of every matching page against a 2KB
        // budget.
        //
        // This is a DENYLIST over a config blob, which fails open: a key added
        // to `config` ships unless somebody remembers this line.
        // `tests/unit/Frontend/PayloadTest.php` pins the keys a payload may
        // carry so that forgetting fails a build instead of a byte budget.
        foreach (self::NOT_SHIPPED as $key) {
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
            // **Beside the payload, never inside it.** The [[Goal]] is what
            // says an Optin's CTA goes back to the cart, and the cart URL is
            // resolved at enqueue from `wc_get_cart_url()` rather than frozen
            // here — so PHP needs it and the browser does not (ADR 0025). A
            // sibling key rather than a payload one is how it reaches the
            // first without costing the second a byte on every matching page
            // view, which is the same split `targeting` already has.
            'goal' => (string) ($row['goal'] ?? ''),
            'targeting' => is_array($targeting) ? $targeting : [],
            // Both keys, always — including empty. The loader reads "no
            // triggers" as "never fires", which is ADR 0012's zero-trigger
            // loss stated rather than guessed at, and it can only read that
            // from a key that is present.
            'payload' => array_merge($published, $vocabulary->partition($rules)),
        ];
    }
}
