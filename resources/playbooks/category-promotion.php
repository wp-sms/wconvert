<?php

/**
 * "Promote an offer" — one range, on the pages that range lives on.
 *
 * The difference from `sale-announcement` is targeting rather than words: that
 * one runs site-wide on `page_load` and says *everything is reduced*, and this
 * one runs on shop archives and says *this range is*. A promotion that fires
 * on a blog post about delivery times is the commonest way this Goal is
 * experienced as spam.
 *
 * `archive` names a post TYPE, so `product` is the same word on every
 * WooCommerce there is. A specific CATEGORY is a term id, which is marked
 * `authored` in the rule manifest because it names a row only one site has —
 * so the merchant narrows it, and the notes say to.
 *
 * `photo-offer` and not `offer-panel`, which `sale-announcement` and all three
 * cart entries already use. A range being promoted has a picture, and this is
 * the free design with somewhere to put one.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'category-promotion',
    'name' => __('One range, on its own pages', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'photo-offer',
    'notes' => __('Runs on your shop pages rather than the whole site, so it never lands on a blog post about delivery times. Narrow it further to the category the offer is actually for — the picture is where the range goes. Measured by click-throughs, so nobody is added to a list.', 'wconvert'),
    'copy' => [
        'headline' => __('The new season has landed', 'wconvert'),
        'body' => __('Explore the newest pieces in the collection and find your favourite.', 'wconvert'),
        'cta_label' => __('See what is new', 'wconvert'),
        'fine_print' => __('Free returns within thirty days.', 'wconvert'),
    ],
    // Six seconds. Long enough to have looked at a listing, short enough that
    // the visitor is still on it — a shop archive is browsed faster than an
    // article is read, which is why this is shorter than `welcome-discount`.
    'rules' => [
        ['type' => 'time_on_page', 'seconds' => 6],
    ],
    'targeting' => [
        'include' => [
            ['type' => 'archive', 'value' => 'product'],
        ],
    ],
];
