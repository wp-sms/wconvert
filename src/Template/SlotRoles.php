<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The seam between a [[Template]]'s design and a [[Playbook]]'s words.
 *
 * A Template declares which [[Slot Role]]s it offers, a Playbook supplies copy
 * against them, and neither needs to know the other's internals — which is
 * what lets the words survive switching Template, and what keeps a Playbook
 * from being married to a single design (CONTEXT.md, Slot Role).
 *
 * ============================================================================
 * A FIELD'S ROLES ARE DERIVED, NOT DECLARED.
 * ============================================================================
 * `resources/templates/manifest.json` gives `field` an empty `roles` list and
 * nonetheless names `email_label`, `email_placeholder` and their `name` and
 * `phone` pairs in its roles vocabulary. The two are consistent rather than in
 * conflict: a field node carries no `role` key because it does not need one —
 * a field capturing an email cannot hold the phone label, so its Roles follow
 * from what it captures. `resources/renderer/src/render.ts` already states the
 * same fact where it explains why two fields of one kind cannot collide.
 *
 * Deriving them is also what keeps the manifest the only list. Writing
 * `email_label → label` out again here would be the fifth hand-maintained
 * cross-cutting list this project has refused (ADR 0019) — and the one most
 * likely to drift, because it would have to be extended by hand every time a
 * field kind is added.
 *
 * **Which keys of a node are words is the manifest's answer**, read through
 * {@see TemplateVocabulary::copyKeysOf()}. That is the same source
 * {@see TemplateVocabulary::withoutCopy()} strips against, so what a snapshot
 * takes out is exactly what a Playbook puts back.
 *
 * @since 0.1.0
 */
final class SlotRoles
{
    /**
     * Every Slot Role a tree offers, in tree order.
     *
     * @param mixed $tree A template's `{steps: [...]}`.
     * @return list<string>
     */
    public static function declaredIn($tree, TemplateVocabulary $vocabulary): array
    {
        $roles = [];

        self::walk($tree, $vocabulary, static function (array $node, array $bindings) use (&$roles): array {
            foreach (array_keys($bindings) as $role) {
                if (!in_array($role, $roles, true)) {
                    $roles[] = $role;
                }
            }

            return $node;
        });

        return $roles;
    }

    /**
     * The words a tree is carrying, keyed by [[Slot Role]].
     *
     * The inverse of {@see self::bind()}, and the reason the pair exists:
     * "because copy is snapshotted separately from design, a [[Playbook]] keys
     * its words to Slot Roles rather than to one Template's structure — **so
     * the words survive switching Template**" (CONTEXT.md, Playbook). A
     * merchant who has written their headline and then finds a design they
     * like better keeps the headline; without this they would retype every
     * slot, which is the cost that makes the gallery a thing you use once.
     *
     * A Role filling several keys comes back as the map of those keys, which
     * is the shape `bind()` writes back — a sentence's link is part of the
     * sentence it sits in, so the two travel together (ADR 0013).
     *
     * ========================================================================
     * A ROLE CLAIMED TWICE COMES BACK AS A LIST, AND ONCE AS ITSELF.
     * ========================================================================
     * Roles repeat (ADR 0051), so a design with three `body` nodes is carrying
     * three bodies. The shape is decided by how many nodes claimed the Role
     * rather than being a list always: one is by far the common case, a bare
     * value is what a [[Playbook]] writes, and a round trip through this pair
     * must not change the shape of copy that was already correct.
     *
     * The ambiguity that creates is real and is resolved by
     * {@see self::wordsFor()}: a Role filling several keys comes back as a MAP
     * (`{text, link}`), and a Role claimed several times comes back as a LIST.
     * Which of the two it is tells them apart, so nothing here has to know
     * which node type is which.
     *
     * @param mixed $tree
     * @return array<string, mixed>
     */
    public static function copyFrom($tree, TemplateVocabulary $vocabulary): array
    {
        /** @var array<string, list<mixed>> $found */
        $found = [];

        self::walk($tree, $vocabulary, static function (array $node, array $bindings) use (&$found): array {
            foreach ($bindings as $role => $keys) {
                $words = [];

                foreach ($keys as $key) {
                    if (array_key_exists($key, $node)) {
                        $words[$key] = $node[$key];
                    }
                }

                if ($words !== []) {
                    // One key comes back as the bare value, which is what a
                    // Playbook writes for every slot but the one that needs a
                    // link inside a sentence. Two spellings of the same words
                    // would make a round trip through this pair change shape.
                    // An options list is one structured value, not repeated
                    // instances of a Role. Keep its named wrapper for bind().
                    $found[$role][] = count($keys) === 1 && $keys[0] !== 'options' ? reset($words) : $words;
                }
            }

            return $node;
        });

        return array_map(
            static fn (array $words) => count($words) === 1 ? $words[0] : $words,
            $found
        );
    }

    /**
     * The same tree with a Playbook's words written into it.
     *
     * A Role the tree does not offer writes nothing rather than inventing a
     * node for it. Registration-time validation makes that unreachable for a
     * Playbook's DEFAULT Template — one filling a Role its Template does not
     * declare is rejected — but the binder still has to be total, because a
     * merchant may switch Template afterwards and the words are meant to
     * survive that.
     *
     * ========================================================================
     * REPEATED ROLES BIND IN TREE ORDER, AND SHORT LISTS SIMPLY RUN OUT.
     * ========================================================================
     * A design with three `body` nodes takes `['Free shipping', 'Early drops',
     * '48h returns']` in the order the nodes appear; one with a single `body`
     * takes the first and ignores the rest (ADR 0051). Words the design has no
     * slot for write NOTHING rather than being appended somewhere — the same
     * posture a Role the tree does not offer already gets, and for the same
     * reason: this binder must be total across a Template switch, and a design
     * with fewer benefit lines than the last one is exactly that switch.
     *
     * A node the list does not reach keeps whatever the design gave it, which
     * for a snapshot is nothing at all — {@see TemplateVocabulary::withoutCopy()}
     * has already taken the words out. So a fourth `body` renders empty, which
     * is the honest picture of a Playbook that supplied three.
     *
     * @param mixed $tree
     * @param array<string, mixed> $copy Role => the words, as a Playbook carries them.
     * @return array{v: int, steps: list<array<string, mixed>>}
     */
    public static function bind($tree, array $copy, TemplateVocabulary $vocabulary): array
    {
        /** @var array<string, int> $bound How many nodes have already taken each Role. */
        $bound = [];

        return self::walk(
            $tree,
            $vocabulary,
            static function (array $node, array $bindings) use ($copy, &$bound): array {
                foreach ($bindings as $role => $keys) {
                    if (!array_key_exists($role, $copy)) {
                        continue;
                    }

                    $at = $bound[$role] ?? 0;
                    $bound[$role] = $at + 1;
                    $words = self::wordsFor($copy[$role], $at);

                    if ($words !== null) {
                        $node = self::write($node, $keys, $words);
                    }
                }

                return $node;
            }
        );
    }

    /**
     * The nth node's share of what a Playbook wrote for one Role, or null.
     *
     * ========================================================================
     * A LIST IS SEVERAL SLOTS. A MAP IS ONE SLOT WITH SEVERAL KEYS.
     * ========================================================================
     * Both arrive as PHP arrays and they mean opposite things, which is the one
     * genuinely ambiguous thing about repeatable Roles. Being a LIST is what
     * tells them apart, and it is exact rather than a heuristic: a Role filling
     * several keys comes back from {@see self::copyFrom()} keyed by those key
     * NAMES (`{text: …, link: …}`), which is never a list; a Role claimed by
     * several nodes comes back keyed `0, 1, 2`, which always is.
     *
     * ========================================================================
     * AND IT IS SPELLED WITHOUT `array_is_list()`, WHICH IS A CHECKER'S DOING.
     * ========================================================================
     * `$words === array_values($words)` is that function, exactly: `===` on
     * arrays holds only where the keys, their order and the values all match,
     * so it is true for `[]` and for `0, 1, 2` and false for every map.
     *
     * Historical context (the minimum is now WordPress 6.8):
     * the builtin says it better and cost a release gate. `array_is_list()` is
     * **PHP 8.1**, the plugin declared `Requires PHP: 8.1`, and WordPress
     * polyfills it anyway — but Plugin Check read it against
     * `Requires at least: 6.2` and reported an ERROR, because core's polyfill
     * landed in 6.5 and the check does not look at the PHP header beside it. It
     * is wrong about this plugin and it is what wp.org runs on submission, so
     * the argument is unwinnable in the place it matters (#96).
     *
     * Revisit when Plugin Check reads `Requires PHP` — `bin/plugin-check.sh`
     * against `latest` is the drift job that would find out.
     *
     * Anything that is not a list is ONE slot's words, so the first node takes
     * it and every node after it takes nothing — rather than every node taking
     * a copy. Three benefit lines all reading "Free shipping" is not what a
     * Playbook supplying one line meant, and it is the failure a merchant would
     * never think to report as a bug.
     *
     * @param mixed $words
     * @return mixed|null Null where this node's turn has nothing in it.
     */
    private static function wordsFor($words, int $at)
    {
        if (is_array($words) && $words === array_values($words)) {
            return $words[$at] ?? null;
        }

        return $at === 0 ? $words : null;
    }

    /**
     * One node's Slot Roles, and which of its copy keys each one fills.
     *
     * @param array<string, mixed> $node
     * @return array<string, list<string>>
     */
    public static function bindingsOf(array $node, TemplateVocabulary $vocabulary): array
    {
        $type = is_string($node['type'] ?? null) ? $node['type'] : '';
        $keys = $vocabulary->copyKeysOf($type);

        // A node with no words in it offers no Role whatever it declares.
        // `image` is the case, and it is the reason a Playbook never supplies
        // one: the template's own asset stays, or the slot stays empty
        // (ADR 0013).
        if ($keys === []) {
            return [];
        }

        if ($type === 'field') {
            return self::fieldBindings($node, $keys, $vocabulary);
        }

        $role = $node['role'] ?? null;

        // One Role, every copy key. A sentence's link is part of the sentence
        // it sits in — the placeholder is the link's only place — so binding
        // them separately would let a Playbook supply half of one (ADR 0013).
        return is_string($role) && in_array($role, $vocabulary->roles(), true) ? [$role => $keys] : [];
    }

    /**
     * A field's Roles, named for what it captures.
     *
     * @param array<string, mixed> $node
     * @param list<string> $keys
     * @return array<string, list<string>>
     */
    private static function fieldBindings(array $node, array $keys, TemplateVocabulary $vocabulary): array
    {
        $name = $node['name'] ?? null;

        if (!is_string($name) || !in_array($name, $vocabulary->fields(), true)) {
            return [];
        }

        $bindings = [];

        foreach ($keys as $key) {
            $role = $name . '_' . $key;

            // Checked against the vocabulary rather than assumed, so a field
            // kind whose Roles nobody declared offers none instead of
            // inventing a name only this file knows.
            if (in_array($role, $vocabulary->roles(), true)) {
                $bindings[$role] = [$key];
            }
        }

        return $bindings;
    }

    /**
     * One Role's words, written against the keys it fills.
     *
     * A plain string fills the first key, which is the text of every node that
     * has one. The structured form — `{text, link}` — is the one case that
     * needs a link inside a sentence, and it names its keys itself so nothing
     * here has to know which node type is which (ADR 0013).
     *
     * @param array<string, mixed> $node
     * @param list<string> $keys
     * @param mixed $words
     * @return array<string, mixed>
     */
    private static function write(array $node, array $keys, $words): array
    {
        if (is_string($words)) {
            $node[$keys[0]] = $words;

            return $node;
        }

        foreach (is_array($words) ? $words : [] as $key => $value) {
            if (in_array((string) $key, $keys, true)) {
                $node[(string) $key] = $value;
            }
        }

        return $node;
    }

    /**
     * Visit every node of a tree, in tree order, rebuilding it as it goes.
     *
     * One walk for both callers, so "where children can be" is asked once —
     * the argument {@see TemplateTree} already makes, and the reason a
     * `split`'s far pane cannot be the one place a reader forgets.
     *
     * @param mixed $tree
     * @param callable(array<string, mixed>, array<string, list<string>>): array<string, mixed> $visit
     * @return array{v: int, steps: list<array<string, mixed>>}
     */
    private static function walk($tree, TemplateVocabulary $vocabulary, callable $visit): array
    {
        $tree = is_array($tree) ? $tree : [];
        $steps = is_array($tree['steps'] ?? null) ? $tree['steps'] : [];
        $visited = [];

        foreach ($steps as $step) {
            if (is_array($step)) {
                $visited[] = self::visitNode($step, $vocabulary, $visit);
            }
        }

        return TemplateTree::stamped(['steps' => $visited]);
    }

    /**
     * @param array<string, mixed> $node
     * @param callable(array<string, mixed>, array<string, list<string>>): array<string, mixed> $visit
     * @return array<string, mixed>
     */
    private static function visitNode(array $node, TemplateVocabulary $vocabulary, callable $visit): array
    {
        $node = $visit($node, self::bindingsOf($node, $vocabulary));

        foreach (TemplateTree::CHILD_KEYS as $key) {
            if (is_array($node[$key] ?? null)) {
                $node[$key] = array_values(array_map(
                    static fn ($child): mixed => is_array($child)
                        ? self::visitNode($child, $vocabulary, $visit)
                        : $child,
                    $node[$key]
                ));
            }
        }

        return $node;
    }
}
