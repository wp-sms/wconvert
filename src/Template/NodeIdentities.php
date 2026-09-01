<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * **A name for every text node, stable across every edit the merchant makes.**
 *
 * ========================================================================
 * A STRING IDENTIFIED BY ITS POSITION MOVES WHEN THE DESIGN IS REARRANGED.
 * ========================================================================
 * Merchant copy lives inside `wconvert_optins.config` as JSON. Both WPML and
 * Polylang translate through a call of the shape
 * `wpml_register_single_string(context, name, value)` — a *name*, not an
 * address — and the only name a node has today is where it happens to sit:
 * `steps[0].children[0]`. Reorder the design and the French headline is
 * attached to the fine print.
 *
 * So a leaf carries `id`, and the string's name becomes `optin-01HA/n3.text`.
 * Moving the block, hiding it, duplicating something above it, adding a step —
 * none of those change it.
 *
 * ========================================================================
 * IT IS MINTED HERE RATHER THAN IN THE ADMIN, AND THAT IS THE DECISION.
 * ========================================================================
 * `resources/admin/src/builder/structure/tree.ts` says, at length, that nothing
 * in the editor may invent a key: a save replaces `config` with what came back,
 * and {@see TemplateVocabulary::normalize()} keeps only the keys the manifest
 * declares. An admin-minted id would survive until the next save and then
 * vanish, taking every translation keyed to it.
 *
 * Minting on the way IN inverts that. Every tree this plugin stores has ids
 * whatever wrote it — the twelve shipped library entries, a snapshot taken
 * before this existed, a `config` a merchant restored from a backup — because
 * they all pass through `normalize()`. The alternative was a data migration
 * over every saved Optin on every site, which is what this exists instead of.
 *
 * ========================================================================
 * UNIQUE ACROSS THE WHOLE TREE, EXACTLY AS A [[Slot Role]] IS.
 * ========================================================================
 * Two nodes claiming `n1` would put two sentences behind one translation. The
 * posture is the mirror of the Role rule one method away: the first claimant
 * keeps it, and a later one is **re-minted** rather than dropped — because a
 * Role a node loses leaves it unbound to a Playbook, which is visible, while an
 * id a node loses leaves it untranslatable, which is not.
 *
 * That is also what makes {@see \WConvert\Rest\OptinController}'s duplicate
 * block safe: the editor strips the id from a copy, and if it ever failed to,
 * the copy is renamed here rather than stealing the original's translation.
 *
 * @since 0.1.0
 */
final class NodeIdentities
{
    /**
     * `n` and up to four digits.
     *
     * Deliberately not a ULID. An id rides the payload on every page view of
     * every page an Optin matches, and there is one per leaf — twenty-six
     * characters each would be most of a kilobyte on a ten-Optin page, against
     * a 2KB gzipped budget (`tests/unit/Frontend/PayloadBudgetTest.php`). It
     * needs to be unique within ONE tree, not in the world.
     *
     * Closed shape rather than "any short string", because the id becomes part
     * of a WPML string name: a `/` in it would collide with the separator, and
     * a supplied id is not something a merchant types anyway — the editor mints
     * none, so anything here came from this class or from a library file.
     */
    private const SHAPE = '/^n[1-9][0-9]{0,3}$/';

    /**
     * @var array<string, true> Every id the tree already carries, reserved
     *                          before the walk starts so nothing minted can
     *                          take one from a node further down.
     */
    private array $reserved = [];

    /** @var array<string, true> Ids a node has actually been given, this walk. */
    private array $claimed = [];

    /** The lowest number not yet handed out. */
    private int $next = 1;

    private function __construct(
        private readonly string $key,
    ) {
    }

    /**
     * The identities in a tree, ready to hand back what it already had.
     *
     * **Pre-scanned, and that is the difference between "stable" and "usually
     * stable".** Minting from a bare counter as the walk goes would let a node
     * with no id take `n1` from a node further down the tree that already had
     * it — which then gets re-minted, and its translation moves. The one thing
     * this class exists to prevent.
     *
     * The scan is structural rather than vocabulary-driven: anything shaped
     * like a node, anywhere under the steps. A `split`'s far pane is exactly
     * where a second reader forgets to look, and a scan that walks the shape
     * cannot forget.
     *
     * @param mixed $steps
     */
    public static function in($steps, string $key): self
    {
        $ids = new self($key);

        self::scan($steps, $ids);

        return $ids;
    }

    /**
     * The id this node keeps: its own where it has a usable one, a fresh one
     * otherwise.
     *
     * @param mixed $id
     */
    public function claim($id): string
    {
        // Reserved and claimed are two different facts, and conflating them is
        // the bug that makes this class not idempotent: on a tree that already
        // has ids, EVERY id is reserved, so a node checking only that would
        // find its own id spoken for and mint a new one — renaming every string
        // on the site on the next save.
        if (is_string($id) && preg_match(self::SHAPE, $id) === 1 && !isset($this->claimed[$id])) {
            $this->claimed[$id] = true;

            return $id;
        }

        while (isset($this->reserved['n' . $this->next]) || isset($this->claimed['n' . $this->next])) {
            $this->next++;
        }

        $minted = 'n' . $this->next;
        $this->claimed[$minted] = true;

        return $minted;
    }

    /**
     * Reserve every id already in the tree, so nothing minted can collide with
     * one the walk has not reached yet.
     *
     * @param mixed $node
     */
    private static function scan($node, self $ids): void
    {
        if (!is_array($node)) {
            return;
        }

        $id = $node[$ids->key] ?? null;

        if (is_string($id) && preg_match(self::SHAPE, $id) === 1) {
            $ids->reserved[$id] = true;
        }

        foreach ($node as $value) {
            self::scan($value, $ids);
        }
    }
}
