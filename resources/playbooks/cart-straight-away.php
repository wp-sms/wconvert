<?php

/**
 * "Bring shoppers back to their cart" — the most intrusive of the three, and
 * the one shipped with the loudest warning in its notes.
 *
 * It shows on arrival. That is the right shape for a returning shopper landing
 * from an email or an ad, and the wrong shape for a store where visitors
 * browse for a while: an immediate overlay is exactly what Google's intrusive-
 * interstitial guidance is about on mobile.
 *
 * The three cart entries are split by INTRUSION rather than by design — all
 * three ride the same one-step, click-metered Template, because what this
 * [[Goal]] needs is a shape it shares with the other click Goal and not a
 * WooCommerce design (ADR 0025). The merchant picks how loudly to ask, and
 * that is the only axis worth three cards.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'cart-straight-away',
    'name' => __('Straight away', 'wconvert'),
    'goal' => 'recover_cart',
    'template_id' => 'offer-panel',
    'notes' => __(
        'The loudest of the three, and the one to be careful with: it shows the moment the page '
        . 'loads. That suits a store whose shoppers arrive back from an email or an ad already '
        . 'meaning to finish, and it suits a browsing audience badly — an immediate overlay on a '
        . 'phone is what search engines mean by an intrusive interstitial. Pair it with targeting '
        . 'rather than running it site-wide.',
        'wconvert'
    ),
    'copy' => [
        'headline' => __('Welcome back', 'wconvert'),
        'body' => __('You still have a cart on the go. Pick up where you left off.', 'wconvert'),
        'cta_label' => __('Finish my order', 'wconvert'),
        'fine_print' => __('Nothing is reserved until you check out.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'page_load'],
        ['type' => 'cart_has_items'],
    ],
];
