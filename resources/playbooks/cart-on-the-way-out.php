<?php

/**
 * "Bring shoppers back to their cart" — the least intrusive of the three.
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
    'notes' => __(
        'The gentlest of the three: it waits until the visitor looks like they are leaving, so it '
        . 'interrupts nothing. Start here — a shopper who has already put something in the cart '
        . 'rarely needs reminding twice. This Optin is measured by clicks back to the cart, so '
        . 'there is nothing to submit and nobody is added to a list.',
        'wconvert'
    ),
    'copy' => [
        'headline' => __('Leaving something behind?', 'wconvert'),
        'body' => __('Your cart is still here, exactly as you left it.', 'wconvert'),
        'cta_label' => __('Back to my cart', 'wconvert'),
        'fine_print' => __('We keep your cart for a couple of days.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'exit_intent'],
        ['type' => 'cart_has_items'],
    ],
];
