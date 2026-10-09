<?php

namespace WConvert\Playbook;

use WConvert\Template\TemplateTree;

defined('ABSPATH') || exit;

/**
 * Where a fresh setup's link buttons go before the merchant says otherwise.
 *
 * ============================================================================
 * A FRESH SETUP HAS NOTHING TO FIX (ADR 0133), AND AN EMPTY LINK IS A FIX.
 * ============================================================================
 * A [[Template]] cannot know a page on this site, so its link buttons arrived
 * with no address — or with a sample one, `/shop/` on a site with no shop —
 * and every offer setup opened with "add a link" before anything else. The
 * one page every site has is its home page, and the one every shop has is its
 * shop page, so the button goes there.
 *
 * **It is a guess, and it says so.** Each button filled here is recorded in
 * `config.unchecked_links` with the address it was given, and the review lists
 * "Check where 'Shop the sale' goes" until that address changes. The record
 * is an authoring note: {@see \WConvert\Optin\PublishedProjection} ships none
 * of it, and a button whose address the merchant cleared still blocks.
 *
 * Cart recovery is left alone: its way back to the cart is the renderer's to
 * resolve (ADR 0025), and a Playbook naming one would be naming a page on one
 * particular site.
 */
final class OfferLinks
{
    /**
     * The tree with every link button pointed at `$href`, and what was changed.
     *
     * @param array<string, mixed> $tree
     * @param 'shop'|'home' $place
     * @return array{0: array<string, mixed>, 1: array<string, array{href: string, place: string}>}
     */
    public static function filled(array $tree, string $href, string $place): array
    {
        $unchecked = [];
        $payload = TemplateTree::rewrittenIn(
            ['template' => ['tree' => $tree]],
            static function (array $node) use ($href, $place, &$unchecked): array {
                if (($node['type'] ?? null) !== 'button' || ($node['action'] ?? null) !== 'link') {
                    return $node;
                }

                $node['href'] = $href;
                if (is_string($node['id'] ?? null)) {
                    $unchecked[$node['id']] = ['href' => $href, 'place' => $place];
                }

                return $node;
            }
        );

        /** @var array<string, mixed> $filled */
        $filled = $payload['template']['tree'];

        return [$filled, $unchecked];
    }

    /**
     * This site's shop page where WooCommerce has one, and its home page otherwise.
     *
     * @return array{href: string, place: 'shop'|'home'}
     */
    public static function onThisSite(): array
    {
        if (function_exists('wc_get_page_id') && function_exists('wc_get_page_permalink') && wc_get_page_id('shop') > 0) {
            $shop = wc_get_page_permalink('shop');
            if (is_string($shop) && $shop !== '') {
                return ['href' => $shop, 'place' => 'shop'];
            }
        }

        return ['href' => home_url('/'), 'place' => 'home'];
    }
}
