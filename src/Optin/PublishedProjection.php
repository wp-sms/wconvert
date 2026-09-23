<?php

namespace WConvert\Optin;

use WConvert\Rules\RuleVocabulary;

defined('ABSPATH') || exit;

/**
 * Rows in, published set out — pure (ADR 0003).
 *
 * The canonical grouped display plan is validated here and shipped without
 * flattening. Account leaves are reduced later for each request (ADR 0104).
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
     * - **`starts_at` and `ends_at` DO ship, and are not in this list because
     *   they are not COPIED.** This originally read *"absent because nothing
     *   puts them here — scheduling is not built"*, and
     *   [#89](https://github.com/navidkashani/wconvert/issues/89) built it.
     *   `SHIPPED` is a copy list, and a schedule is the one payload key that
     *   is not a copy of anything: `config` holds the LOCAL WALL TIME the
     *   merchant authored and the payload holds an absolute INSTANT, resolved
     *   here against the site's zone ({@see Schedule}). Two names for one
     *   fact would be worse — the pair is projected below, where the
     *   transformation is visible, and pinned by
     *   `tests/unit/Optin/PublishedProjectionTest.php` the same way the copy
     *   list is.
     */
    private const SHIPPED = ['template', 'display_type', 'placement', 'inline_placement', 'content_lock', 'teaser', 'frequency', 'priority'];

    /**
     * The arm this entry is, of the test it belongs to:
     * `[experiment id, this arm's index, how many arms]`.
     *
     * ========================================================================
     * THE ONE THING A/B ADDS TO THE PAYLOAD, AND IT IS A TRIPLE OF SCALARS.
     * ========================================================================
     * A [[Variant]] is a whole Optin (ADR 0045), so two published arms would
     * otherwise reach the browser as two independent entries and
     * `decide.ts`'s `arbitrate()` would read them as two campaigns competing
     * for the screen rather than as one choice. Nothing in the payload said
     * they were arms of one thing, because `parent_id` was not in the
     * projection at all.
     *
     * **All three fields are needed and none of them is derivable on the
     * page.** The experiment id is what the drawn arm is remembered against
     * — `wcv1[parentId].v`, the parent's own record. The index is which arm
     * THIS entry is. And the COUNT is the one a reader assumes can be
     * counted off the page and cannot: an arm is dropped from a page it does
     * not target and from one where it is [[Suspended]], so a browser whose
     * first page carries one arm of two would draw from a set of one and
     * always meet arm A. The count travels so the draw is over the test
     * rather than over the page.
     *
     * **Absent on everything that is not an arm**, which is every Optin on
     * every install running no test — a group of one is not a test, so the
     * key is not written and the payload is byte-for-byte the one it is
     * today. It disappears again when a test ends, because ending one leaves
     * the parent alone in its group (ADR 0003 rebuilds on write, so that
     * happens in the same call).
     *
     * Read by Pro alone. Free's loader has no field for it, which is the same
     * standing `goal` has one level up: present, unread, and costing free's
     * bundle nothing (ADR 0029).
     *
     * ========================================================================
     * THE WORD IS `variant`, AND THE LENGTH OF IT IS DELIBERATE.
     * ========================================================================
     * It was `ab`, which is shorter and is what the payload budget would
     * choose. A minifier keeps a property access as `.ab`, and `.ab` is not
     * something a scan can look for in 9 KB of minified JavaScript without
     * matching half of it — so the one thing `bin/check-loader.mjs` proves
     * about a per-tier build, that a Basic bundle carries no higher rung's
     * code, would have had no observable token to prove it with.
     *
     * `.variant` is unmistakable in a bundle, it is the word CONTEXT.md
     * already uses for the thing, and it costs four bytes on an arm and
     * nothing at all on any other Optin.
     */
    public const ARM = 'variant';

    /**
     * Where an `inline` arm renders — the id of the anchor on the page.
     *
     * ========================================================================
     * IT IS A GENERIC KEY AND IT EXISTS BECAUSE OF ONE CASE.
     * ========================================================================
     * `inline` is the one [[Display Type]] that needs somewhere on the page
     * to go, and `resources/loader/src/present.ts` finds it with one
     * `document.querySelector` on `[data-wconvert-optin="<id>"]`
     * ({@see \WConvert\Frontend\InlineAnchor}). A [[Variant]] has its own id
     * and the merchant placed exactly one block, naming the parent — so
     * without this an inline arm B renders nowhere at all, silently, for half
     * the traffic.
     *
     * The block names the CAMPAIGN, which is what a test is, so the arm
     * renders at the campaign's anchor. Spelled as its own key rather than
     * read out of {@see self::ARM} deliberately: free's presenter is what
     * reads this, and it must not learn to spell an experiment field to do
     * its own job. What it needs is *"this Optin renders at another id's
     * anchor"*, and that is all this says.
     *
     * Written only where it is both true and load-bearing: an arm that is not
     * the parent, whose Display Type is `inline`. Every overlay skips it,
     * because an overlay mounts itself and never looks for an anchor.
     */
    public const ANCHOR = 'anchor';

    /**
     * @param iterable<array<string, mixed>> $rows
     * @return list<array<string, mixed>>
     */
    public static function build(iterable $rows, RuleVocabulary $vocabulary, \DateTimeZone $siteZone): array
    {
        // Materialised because the arms below are a fact about the SET rather
        // than about a row, so this walk happens twice and a generator would
        // be spent by the first one.
        $rows = array_values(is_array($rows) ? $rows : iterator_to_array($rows, false));
        $arms = self::armsIn($rows);
        $set = [];

        foreach ($rows as $row) {
            $entry = self::project($row, $vocabulary, $siteZone, $arms);

            if ($entry !== null) {
                $set[] = $entry;
            }
        }

        // During sequential A/B publication, keep every region readable until
        // all published arms agree. Never expose a partially gated family.
        $modes = [];
        foreach ($set as $entry) {
            $payload = $entry['payload'];
            $family = $payload[self::ARM][0] ?? $payload['campaign'] ?? $entry['id'];
            $modes[$family][] = isset($payload['content_lock']);
        }
        foreach ($set as &$entry) {
            $payload = &$entry['payload'];
            $family = $payload[self::ARM][0] ?? $payload['campaign'] ?? $entry['id'];
            if (in_array(false, $modes[$family], true)) {
                unset($payload['content_lock']);
                // Family pacing survives even when lock modes cannot be composed.
            }
        }
        unset($entry, $payload);
        return $set;
    }

    /**
     * Every published arm, by Optin id, as `[experiment id, index, count]`.
     *
     * ========================================================================
     * A TEST IS A GROUP OF MORE THAN ONE, AND NOTHING STORES THAT IT IS ONE.
     * ========================================================================
     * The group key is `parent_id` where there is one and the row's own id
     * where there is not — so a parent and its children land in the same
     * group and every ordinary Optin lands alone in its own. **A group of one
     * is not a test**, gets no key, and costs the payload nothing. That is
     * what makes "is a test running" a question answered by the rows rather
     * than by a `finished` flag somebody has to set: declaring a winner
     * leaves the parent alone in its group, and the arm key stops being
     * written on the rebuild that same write triggers (ADR 0003).
     *
     * **Only rows that are in the SET are counted.** An arm the merchant
     * unpublished is not being served, so a browser must not be able to draw
     * it and sit looking at nothing — the count is over what a visitor could
     * actually meet, and the loader re-draws an index the count no longer
     * reaches.
     *
     * A child whose parent is unpublished is therefore alone in a group named
     * after a row that is not here. It serves on its own, which is what
     * unpublishing the other arm means.
     *
     * **Ordered by id**, which is ordering by the moment each arm was created
     * (a ULID's leading 48 bits), so the parent is always index 0 and adding a
     * third arm never renumbers the first two. Sorted here rather than
     * trusted from the caller's `ORDER BY`, because this is a pure function
     * over rows and a test hands it whatever order it likes.
     *
     * @param list<array<string, mixed>> $rows
     * @return array<string, array{0: string, 1: int, 2: int}>
     */
    private static function armsIn(array $rows): array
    {
        $groups = [];

        foreach ($rows as $row) {
            if (self::isExcluded($row)) {
                continue;
            }

            $id = (string) ($row['id'] ?? '');
            $parent = (string) ($row['parent_id'] ?? '');

            if ($id === '') {
                continue;
            }

            $groups[$parent === '' ? $id : $parent][] = $id;
        }

        $arms = [];

        foreach ($groups as $experiment => $ids) {
            if (count($ids) < 2) {
                continue;
            }

            sort($ids);

            foreach ($ids as $index => $id) {
                $arms[$id] = [(string) $experiment, $index, count($ids)];
            }
        }

        return $arms;
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
     * ========================================================================
     * A SCHEDULE IS NOT ON THIS LIST, AND IT IS THE ONE MOST PEOPLE WOULD ADD.
     * ========================================================================
     * An Optin whose window has not opened is IN the set, and so is one whose
     * window has closed. Excluding either looks obviously right and is the bug
     * this ticket exists to avoid: the set is rebuilt on WRITE and never on a
     * timer (ADR 0003), so nothing re-runs at the moment a window opens — a
     * not-yet-started Optin left out here is left out of every page a
     * full-page cache serves until somebody republishes, which may be days
     * after the sale began.
     *
     * So the Optin ships, carrying its two instants, and the browser decides
     * ({@see ../../resources/loader/src/schedule.ts}). The far end is the same
     * argument in reverse: a page cached while the window was open still holds
     * the payload, and it can only work out that the window has shut from a
     * fact it was given. An Optin leaves the set when the merchant unpublishes
     * it, which is the act that means *stop*.
     *
     * A schedule differs from suspension here, and the difference is why one
     * is an exclusion and the other is not: suspension is computed against a
     * live registry the payload cannot carry, so a stale cached page has to be
     * caught again at the beacon
     * ({@see PublishedOptin::servableIdsIn()}). A window is one number, it
     * travels, and the page holding it can answer for itself — including a
     * page cached before the window closed. Nothing about scheduling needs a
     * second question asked at the beacon, and an Optin outside its window
     * shows nothing, so it reports nothing and no counter ever receives a row
     * (ADR 0027's reading, arrived at by the payload rather than by a filter).
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
     * @param array<string, array{0: string, 1: int, 2: int}> $arms
     * @return array<string, mixed>|null
     */
    private static function project(
        array $row,
        RuleVocabulary $vocabulary,
        \DateTimeZone $siteZone,
        array $arms
    ): ?array {
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

        // Only the canonical saved plan can publish; old development drafts
        // must be repaired explicitly in the builder (ADR 0104).
        $plan = $published['display_rules'] ?? [];
        if (!is_array($plan) || \WConvert\Rules\DisplayPlan::issues($plan, $vocabulary) !== []) return null;

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

        if (isset($payload['template'])) {
            $payload['template'] = \WConvert\Template\CaptureContract::template($published, (string) ($row['goal'] ?? ''), get_privacy_policy_url());
            if (($payload['template']['tree']['submissions'] ?? []) !== []) {
                $payload['capture_contract'] = \WConvert\Template\CaptureContract::fingerprint($published, (string) ($row['goal'] ?? ''), get_privacy_policy_url());
            }
        }

        if (isset($payload['content_lock'])) {
            $lock = ContentLock::normalize($payload['content_lock']);
            if ($lock === null || !ContentLock::compatible($published, \WConvert\Rules\DisplayPlan::compatibilityTriggers($plan))) {
                unset($payload['content_lock']);
            } else {
                $payload['content_lock'] = $lock;
                $parent = (string) ($row['parent_id'] ?? '');
                if ($parent !== '') {
                    $payload['campaign'] = $parent;
                    $payload[self::ANCHOR] = $parent;
                }
            }
        }

        // ====================================================================
        // AND THE ARM, WHICH IS THE ONE PAYLOAD KEY THAT IS NOT A FACT ABOUT
        // THIS ROW ALONE.
        // ====================================================================
        // Every key above is copied out of this Optin's own `published_config`.
        // This one is computed across the whole set, once per rebuild, because
        // *"how many arms does this test have"* is not something a row knows
        // and is not something the page can count (see {@see self::ARM}).
        //
        // It is appended after `SHIPPED` rather than added to it, and the two
        // are different lists on purpose: `SHIPPED` is a COPY list, pinned by
        // `tests/unit/Optin/PublishedProjectionTest.php` so that a key added
        // to `config` reaches nobody until somebody writes down why it
        // renders. A derived key has no `config` entry to copy and would make
        // that list mean two things.
        $arm = $arms[(string) ($row['id'] ?? '')] ?? null;

        if ($arm !== null) {
            $payload[self::ARM] = $arm;
            $payload['campaign'] = $arm[0];

            // Only a child, and only where it renders in place. The parent's
            // anchor IS its own id, so writing this for it would be the same
            // value under a second name; an overlay never looks for an anchor
            // at all ({@see self::ANCHOR}).
            if ($arm[0] !== (string) ($row['id'] ?? '') && DisplayType::of($published['display_type'] ?? null) === DisplayType::Inline) {
                $payload[self::ANCHOR] = $arm[0];
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
            'payload' => array_merge(
                $payload,
                Schedule::windowIn($published, $siteZone),
                ['display_rules' => $plan],
                ($row['goal'] ?? '') === \WConvert\Goal\Goal::RecoverCart->value ? ['required_rules' => [['type' => 'cart_has_items']]] : []
            ),
        ];
    }
}
