<?php

/**
 * "Bring shoppers back to their cart" — an invitation when a shopper appears to be leaving.
 *
 * It waits for the visitor to signal that they are leaving, so it interrupts
 * nothing they were doing: the popup is the last thing between them and the
 * back button rather than something dropped over the product they were
 * reading.
 *
 * Click-metered like the other cart entries, so it captures nothing — no form,
 * no [[Lead]], no [[Consent Record]], no [[Destination]] (ADR 0025). The CTA
 * carries a label and no `href`: the way back to the cart is site-local and a
 * [[Playbook]] can express nothing site-local, so the renderer resolves it
 * from `wc_get_cart_url()` and the merchant may override it in the settings
 * panel.
 *
 * It names `exit_intent`, which is [[Pro]]'s — and that is safe here in a way
 * it would not be under any other [[Goal]]. The cart Goal is `tier: pro` and
 * needs WooCommerce, so Pro is present by definition wherever this entry is
 * reachable and ADR 0012's substitution table has no work to do inside it
 * (ADR 0026).
 */

defined('ABSPATH') || exit;

return [
    'id' => 'cart-on-the-way-out',
    'name' => __('On the way out', 'wconvert'),
    'goal' => 'recover_cart',
    'template_id' => 'offer-panel',
    'notes' => __('Waits for exit intent before showing a popup to shoppers with items in their cart. Consider the inline cart return for a quieter option. This counts clicks back to the cart, captures no details and adds nobody to a list. Check the mobile fallback and frequency before publishing.', 'wconvert'),
    'copy' => [
        'headline' => __('Leaving something behind?', 'wconvert'),
        'body' => __('Open your cart when you are ready to take another look.', 'wconvert'),
        'cta_label' => __('Back to my cart', 'wconvert'),
        'fine_print' => __('Items are not reserved. Prices and availability can change.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'exit_intent'],
        ['type' => 'cart_has_items'],
    ],
];
