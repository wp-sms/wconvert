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
     * ========================================================================
     * THE KEYS THE BROWSER IS SENT. AN ALLOWLIST, AND THAT DIRECTION IS THE
     * WHOLE POINT.
     * ========================================================================
     * This was a **denylist** — three keys stripped and the rest of
     * `published_config` shipped — and its own comment named the hazard it
     * carried: *"a key added to `config` ships unless somebody remembers this
     * line."*
     *
     * **Somebody did not.** `destinations` — the [[Destination]] ULIDs an
     * Optin binds, under {@see \WConvert\Destination\OptinBinding::KEY} — was
     * never on the strip list and is stripped nowhere else between
     * `published_config` and the `<script>` tag. Every published Optin with a
     * Destination bound shipped those ids to every visitor of every matching
     * page. The loader has no field for them, so they were bytes with no
     * reader rather than a working leak — but nothing in the code made that
     * true on purpose, and the pinning test passed because its fixture had no
     * `destinations` key at all.
     *
     * Spelled this way round, a key added to `config` for the builder's
     * benefit reaches nobody until somebody writes it down here and says why
     * it renders. The failure direction is the difference: forgetting used to
     * publish, and now it withholds.
     *
     * **This is the closed-vocabulary discipline the rest of the config
     * already gets**, applied to the one place it was written backwards.
     * `rules`, `targeting` and `template` are each normalised on the way in
     * against a set that is closed in PHP; the projection is what decides what
     * leaves, and it should be closed the same way.
     *
     * The order is the payload's order, so the `<script>` tag is byte-stable
     * across saves rather than following whatever order a config blob's keys
     * happen to be in. It matches `PayloadEntry` in
     * `resources/loader/src/types.ts`, minus the three the projection produces
     * itself: `id` from the row, and `triggers` and `conditions` from the
     * partition below.
     *
     * What is NOT here, and why, since the reasons are the ones a future key
     * will be weighed against:
     *
     * - **`template_id` and `playbook_id` are provenance.** Both are ids into
     *   a registry the front end never consults: an Optin takes a COPY of its
     *   [[Template]] and a COPY of its [[Playbook]]'s words, so improving
     *   either entry restyles nothing and deleting either leaves the Optin
     *   working. There is nothing left for an id to do on the page.
     * - **`destination_hint` is an authoring note.** It names [[Destination]]
     *   *types* and the [[Lead]] fields a Playbook wanted, for the builder to
     *   act on — and prefill never binds a Destination invisibly, so it is not
     *   even a decision yet.
     * - **`destinations` is server state about where a [[Lead]] goes.** The
     *   capture path re-reads it from the server's own published copy and
     *   trusts the client for nothing but the values a person typed
     *   (ADR 0004), so the browser has no use for it and never had.
     * - **`starts_at` and `ends_at` are absent because nothing puts them
     *   here** — scheduling is not built. When it is, it ships: the projection
     *   includes scheduled Optins by design so a cached page can receive one,
     *   and the comparison is the loader's.
     */
    private const SHIPPED = ['template', 'display_type', 'frequency', 'priority'];

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

        // **Beside the payload, never inside it** — the one key that is read
        // out of the blob and projected as a SIBLING rather than shipped. It
        // was answered on the server, and sending it would pay for it twice
        // and hand the browser a rule it has no reason to re-evaluate
        // (ADR 0005).
        $targeting = $published['targeting'] ?? [];

        // The flat list is CONSUMED, not shipped beside its own partition:
        // two spellings of one rule set in one payload is a second source of
        // truth the loader would have to choose between, and bytes on every
        // page view. It is not in `SHIPPED`, so the consumption is now
        // structural rather than an `unset()` somebody has to keep.
        $rules = $published['rules'] ?? [];

        // ONLY THE KEYS SOMEBODY WROTE DOWN. Everything a merchant, a
        // [[Playbook]] or a future ticket has put in `config` stays on the
        // server unless it appears in `SHIPPED` — so the payload is a
        // decision rather than a residue, and the 2KB budget it is inlined
        // against is spent on things that render.
        // `tests/unit/Optin/PublishedProjectionTest.php` pins the list, so
        // adding a key fails a build until somebody says why it renders.
        $payload = [];

        foreach (self::SHIPPED as $key) {
            if (array_key_exists($key, $published)) {
                $payload[$key] = $published[$key];
            }
        }

        // The partition can no longer be beaten by the blob, and it is the
        // allowlist that does it rather than the merge order. `triggers` and
        // `conditions` are not shippable keys, so a config carrying its own —
        // hand-written, or left by an older shape — cannot reach `$payload` to
        // compete in the first place. The manifest decides what the two axes
        // hold; nothing in the blob gets a vote.
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
            'payload' => array_merge($payload, $vocabulary->partition($rules)),
        ];
    }
}
