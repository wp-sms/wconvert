<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/**
 * The countable act an [[Optin]] exists to produce, in one of its two
 * spellings.
 *
 * **One Optin has exactly one converting act, and its DESIGN decides which**
 * (CONTEXT.md, Conversion): a design whose button submits converts on the
 * submit, and one whose button links away converts on the click. A
 * [[Template]] offering both is rejected when it is registered, not
 * disambiguated at runtime — an Optin with two candidate Conversions has no
 * honest number to report.
 *
 * ============================================================================
 * IT SAID "ITS [[GOAL]] DECIDES WHICH", AND THE GOAL WAS THE SECOND ANSWER.
 * ============================================================================
 * A Goal declared a `convertingAct()` as well, and every act-shaped refusal in
 * the product existed to keep the two from disagreeing — including the one
 * that greyed out five of seven designs in the picker. The refusal below is
 * the enforcement and always was: a registered design offers exactly one act,
 * so there is nothing for a second declaration to add. The Goal's is deleted
 * (ADR 0059) and this is the only one left.
 *
 * That is also why the detection lives here rather than in the renderer. The
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

    /** Showing the selected result after completing the active questions. */
    case Match = 'match';

    /** A server-confirmed WooCommerce addition; supporting product links do not convert. */
    case AddToCart = 'add_to_cart';

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
        return match ($this) { self::Submit => 'submit', self::Click => 'link', self::Match => 'next', self::AddToCart => 'add_to_cart' };
    }

    /**
     * Every act a tree offers, once each, in this enum's order.
     *
     * A Results screen offers Match regardless of whether contact is required
     * before it. Without Results, a button offers Submit or Click; navigation
     * buttons are not acts.
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
        $resultAt = array_search('result', array_column(is_array($tree['steps'] ?? null) ? $tree['steps'] : [], 'kind'), true);
        if ($resultAt !== false) {
            return [self::Match];
        }
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

        if (($node['type'] ?? null) === 'products') $found[] = ($node['action'] ?? 'link') === 'add_to_cart' ? self::AddToCart : self::Click;
        if (($node['type'] ?? null) === 'button' && in_array($node['action'] ?? null, ['submit', 'link'], true)) {
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
