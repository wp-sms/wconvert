<?php

/**
 * "Bring shoppers back to their cart" — the middle of the three.
 *
 * It waits a little, so it lands on a visitor who has settled into a page
 * rather than one who just arrived, and it does not depend on catching them
 * leaving. That makes it the one that works on a phone, where there is no
 * mouse to leave the viewport and `exit_intent` therefore has far less to
 * read.
 *
 * Click-metered, so it captures nothing (ADR 0025), and the CTA's destination
 * is resolved by the renderer from `wc_get_cart_url()` — a Playbook can
 * express nothing site-local.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'cart-after-a-while',
    'name' => __('Cart reminder after a delay', 'wconvert'),
    'goal' => 'recover_cart',
    'template_id' => 'offer-panel',
    'notes' => __('The one to reach for on a mobile-heavy store: there is no mouse to leave the viewport on a phone, so an exit-intent reminder has much less to read there. Fifteen seconds is long enough that the visitor has settled in and short enough that they are still shopping. Measured by clicks back to the cart — nothing is submitted and nobody joins a list.', 'wconvert'),
    'copy' => [
        'headline' => __('Still thinking it over?', 'wconvert'),
        'body' => __('Everything you picked is waiting in your cart.', 'wconvert'),
        'cta_label' => __('Take another look', 'wconvert'),
        'fine_print' => __('Nothing is reserved until you check out.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'time_on_page', 'seconds' => 15],
        ['type' => 'cart_has_items'],
    ],
];
