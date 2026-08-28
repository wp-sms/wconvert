<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * What a [[Template]] IS, read off its own tree.
 *
 * ============================================================================
 * EVERY FACET IS DERIVED. NOTHING HERE IS AUTHORED, SO NOTHING HERE CAN DRIFT.
 * ============================================================================
 * The competitors' galleries filter by Goal, Industry and Season, and those
 * work because their templates contain words and pictures of a bakery. A
 * WConvert Template is the design of an Optin **with no words in it** — copy
 * lives on the [[Playbook]] — and that boundary is exactly what collapsed the
 * Display Type × Goal matrix to "N designs per Display Type" (CONTEXT.md,
 * Template). Authoring an industry or season taxonomy over these files would
 * tag them for something they do not contain.
 *
 * So a facet is a question the TREE can answer: what does this design capture,
 * how is it arranged, does it have a picture. `tier` is the one authored fact
 * about an entry and it is not here, because it is a fact about the
 * distribution rather than about the design.
 *
 * **Computed on the server, once, at registration.** The admin has
 * `convertingActOf` and could derive all of this for itself — but the index
 * route deliberately withholds trees ({@see \WConvert\Rest\TemplateController}),
 * so the client will not have one to read. A gallery that had to download
 * forty trees to draw its filter chips is the thing the split exists to stop.
 *
 * **The VOCABULARY of the offered filters lives in the manifest**, as a
 * sibling `facets` section, which is ADR 0010's rule read literally: a control
 * that ENUMERATES reads its enumeration from the manifest. The words for those
 * values are {@see TemplateLabels::facetValues()}'s, because `wp i18n make-pot`
 * cannot see a string inside JSON.
 *
 * ============================================================================
 * SIX ARE DERIVED. THREE ARE OFFERED AS FILTERS.
 * ============================================================================
 * `shape`, `captures` and `has_image` are the three someone comparing designs
 * actually uses. The other three are derived and travel, and none of them is a
 * chip:
 *
 * - `act` is not a filter, it is the **refusal marking** — a design converting
 *   on a click cannot serve a Goal that counts submissions, and that is said on
 *   the card with the reason rather than hidden by a control (ADR 0025).
 * - `asks_consent` is not something a merchant browses by.
 * - `display_type` is the Optin's, and the gallery is already filtered on it —
 *   a question asked twice.
 *
 * That is ADR 0042 rule 2 applied to a toolbar: *does knowing this change what
 * they do next?*
 *
 * @since 0.1.0
 */
final class TemplateFacets
{
    /**
     * The facets offered as filter chips, which is the section the manifest
     * enumerates.
     *
     * Spelled here as the KEYS this class produces and in the manifest as the
     * VALUES each one offers; {@see \WConvert\Tests\Unit\Template\TemplateLabelParityTest}
     * fails in both directions, so a facet offered by one and not the other is
     * a red build rather than an empty chip strip.
     */
    public const FILTERED = ['shape', 'captures', 'has_image'];

    /**
     * One entry's facets, from its tree.
     *
     * `display_type` is not in here. It sits at the top level of an index
     * entry, where it already was, because one Template serves exactly one
     * Display Type (CONTEXT.md, Template) and a second spelling of it inside
     * this map would be a fact two readers could disagree about.
     *
     * @param array{steps: list<mixed>}|array<string, mixed> $tree A validated template tree.
     * @param list<string> $fields What a `field` node may capture, from the manifest.
     * @return array{act: string|null, captures: list<string>, shape: string|null, has_image: bool, asks_consent: bool}
     */
    public static function of(array $tree, array $fields): array
    {
        $acts = ConvertingAct::offeredIn($tree);
        $found = self::walk($tree);

        return [
            /*
             * **Singular by construction rather than by assumption.**
             * `TemplateLibrary::refuse()` rejects an entry offering two acts or
             * none before it is ever registered, so by the time anything reads
             * this there is exactly one. Null is what an unregistered tree
             * would produce and is kept expressible rather than asserted away —
             * this is a pure function and is called by tests on trees that
             * never reached registration.
             */
            'act' => $acts === [] ? null : $acts[0]->value,
            /*
             * What a visitor is asked for, in the manifest's own words for a
             * field kind. Intersected with the manifest rather than trusted,
             * so a `name` the vocabulary does not declare cannot become a chip
             * nothing else in the admin can name.
             */
            'captures' => array_values(array_filter(
                $fields,
                static fn (string $field): bool => in_array($field, $found['fields'], true)
            )),
            /*
             * **Step 0's ROOT layout, and only step 0's.** A submit-metered
             * design has a terminal success step (ADR 0025) whose arrangement
             * is a consequence of having two lines in it rather than a
             * statement about the design — so a Side by side whose success step
             * is a Column is a Side by side, and reading both steps would make
             * that a design with no shape.
             */
            'shape' => $found['shape'],
            'has_image' => $found['has_image'],
            'asks_consent' => $found['asks_consent'],
        ];
    }

    /**
     * A design with **no tree**, from the facets its entry authored.
     *
     * ========================================================================
     * THE ONE PLACE A FACET IS WRITTEN RATHER THAN READ, AND IT HAS TO BE.
     * ========================================================================
     * Every facet is derived precisely so it cannot drift from the design it
     * describes — and {@see LockedTemplates} is the entry that has no design to
     * read, because shipping premium trees in the free ZIP and refusing the
     * save is trialware (issue #7). So `locked.json` writes them down beside the
     * name.
     *
     * The exception is kept from becoming a hole by **normalising against the
     * manifest**: a stub claiming a `shape` no layout declares would draw a chip
     * nothing in this admin can name, and it is dropped here instead. What
     * survives is exactly the vocabulary the chip strip enumerates.
     *
     * **The SHAPE of the result is {@see self::of()}'s, exactly.** One kind of
     * object reaches the client whether the entry had a tree or not, so the
     * picker draws a locked card with the same code that draws a real one —
     * which is what makes a locked card interleave in place rather than being a
     * second kind of thing the grid has to know about.
     *
     * `act` and `asks_consent` are absent from that vocabulary and stay at
     * their empty values. A locked card is never offered, so it is never
     * refused for its act either: the message on it is the upsell, and a second
     * one about a Goal it cannot serve would be a sentence about a design the
     * merchant cannot have.
     *
     * @param mixed $authored Whatever the entry wrote under `facets`.
     * @param array<string, list<string>> $offered The manifest's `facets` section.
     * @return array{act: string|null, captures: list<string>, shape: string|null, has_image: bool, asks_consent: bool}
     */
    public static function authored($authored, array $offered): array
    {
        $authored = is_array($authored) ? $authored : [];

        $shape = $authored['shape'] ?? null;
        $captures = is_array($authored['captures'] ?? null) ? $authored['captures'] : [];

        return [
            'act' => null,
            'captures' => array_values(array_intersect(
                $offered['captures'] ?? [],
                array_values(array_filter($captures, 'is_string'))
            )),
            'shape' => is_string($shape) && in_array($shape, $offered['shape'] ?? [], true) ? $shape : null,
            'has_image' => ($authored['has_image'] ?? false) === true,
            'asks_consent' => false,
        ];
    }

    /**
     * One pass over the tree for everything but the act.
     *
     * The walk is {@see TemplateTree::childrenOf()}'s, so a `split`'s far pane
     * is visited — which is exactly where the only `image` in a design sits.
     *
     * @param array<string, mixed> $tree
     * @return array{fields: list<string>, shape: string|null, has_image: bool, asks_consent: bool}
     */
    private static function walk(array $tree): array
    {
        $steps = is_array($tree['steps'] ?? null) ? array_values($tree['steps']) : [];
        $first = $steps[0] ?? null;

        $found = [
            'fields' => [],
            'shape' => is_array($first) && is_string($first['type'] ?? null) ? $first['type'] : null,
            'has_image' => false,
            'asks_consent' => false,
        ];

        foreach ($steps as $step) {
            self::collect($step, $found);
        }

        return $found;
    }

    /**
     * @param mixed $node
     * @param array{fields: list<string>, shape: string|null, has_image: bool, asks_consent: bool} $found
     */
    private static function collect($node, array &$found): void
    {
        if (!is_array($node)) {
            return;
        }

        $type = $node['type'] ?? null;

        if ($type === 'field' && is_string($node['name'] ?? null) && !in_array($node['name'], $found['fields'], true)) {
            $found['fields'][] = $node['name'];
        }

        if ($type === 'image') {
            $found['has_image'] = true;
        }

        if ($type === 'consent') {
            $found['asks_consent'] = true;
        }

        foreach (TemplateTree::childrenOf($node) as $child) {
            self::collect($child, $found);
        }
    }
}
