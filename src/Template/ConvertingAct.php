<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The countable act an [[Optin]] exists to produce, in one of its two
 * spellings.
 *
 * **One Optin has exactly one converting act, and its [[Goal]] decides which**
 * (CONTEXT.md, Conversion): where the Goal is measured by submissions the
 * form's submit is the Conversion, and where it is measured by click-throughs
 * the CTA is. A [[Template]] offering both is rejected when it is registered,
 * not disambiguated at runtime — an Optin with two candidate Conversions has
 * no honest number to report.
 *
 * That is why the detection lives here rather than in the renderer. The
 * renderer already knows which button is which; what it cannot do is refuse,
 * because by then a merchant has a published Optin and the refusal would be a
 * blank popup. Registration is the moment there is still an author to tell.
 *
 * @since 0.1.0
 */
enum ConvertingAct: string
{
    /** The form's submit. Produces a [[Lead]], and the Template has a terminal success step. */
    case Submit = 'submit';

    /** The CTA's navigation. Produces a Conversion and no Lead, and the Template has one step. */
    case Click = 'click';

    /**
     * How many steps a Template metered by this act has.
     *
     * A submit-metered template has **two** — the post-submit success state is
     * a terminal step. A click-metered one has **one**: the click navigates the
     * visitor away, so there is no success state left to render and an
     * interstitial is worse than the navigation it delays. It is a property of
     * the metric rather than of WooCommerce, so it holds for both click Goals
     * (ADR 0010, corrected by ADR 0025).
     */
    public function steps(): int
    {
        return $this === self::Submit ? 2 : 1;
    }

    /**
     * The `action` a `button` carries to produce this act.
     *
     * **The one place `link` is spelled beside `submit`.** They are the node
     * param's two values, and they are NOT this enum's two values: a Goal is
     * metered by `submit` or `click`, and a button that produces a click
     * carries `action: "link"`. Two vocabularies for one distinction, kept
     * apart here so nothing downstream has to remember which it is holding —
     * {@see self::collect()} reads it back, {@see TemplateLabels::params()}
     * names both, and the editor's `actionFor()` is the mirror on the other
     * side of the boundary.
     */
    public function action(): string
    {
        return $this === self::Submit ? 'submit' : 'link';
    }

    /**
     * Every act a tree offers, once each, in this enum's order.
     *
     * A `button` node is the only thing that converts, and its `action` param
     * is which of the two it is — `link` navigates, anything else submits,
     * which is the same default the renderer takes so the two cannot disagree
     * about an omitted param.
     *
     * The walk covers every step and every pane, through
     * {@see TemplateTree::childrenOf()}, because a `split`'s far pane is
     * exactly where a second converting act would hide from a reader.
     *
     * @param mixed $tree A template's `{steps: [...]}`, validated or not.
     * @return list<self>
     */
    public static function offeredIn($tree): array
    {
        $tree = is_array($tree) ? $tree : [];
        $found = [];

        foreach (is_array($tree['steps'] ?? null) ? $tree['steps'] : [] as $step) {
            self::collect($step, $found);
        }

        return array_values(array_filter(self::cases(), static fn (self $act): bool => in_array($act, $found, true)));
    }

    /**
     * @param mixed $node
     * @param list<self> $found
     */
    private static function collect($node, array &$found): void
    {
        if (!is_array($node)) {
            return;
        }

        if (($node['type'] ?? null) === 'button') {
            $act = ($node['action'] ?? null) === self::Click->action() ? self::Click : self::Submit;

            if (!in_array($act, $found, true)) {
                $found[] = $act;
            }
        }

        foreach (TemplateTree::childrenOf($node) as $child) {
            self::collect($child, $found);
        }
    }
}
