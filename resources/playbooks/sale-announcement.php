<?php

/**
 * "Promote a sale or offer" — click-metered, so it captures nothing.
 *
 * No form, no [[Lead]], no [[Consent Record]] and no [[Destination]]: its
 * whole product is a message on the page and a link through to the offer. The
 * Conversion is the click, and the Template it names has ONE step, because the
 * click navigates the visitor away and there is no success state left to
 * render (ADR 0025).
 *
 * The link's destination is the merchant's, set in the builder. A Playbook can
 * express nothing site-local, and every sale is somewhere different.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'sale-announcement',
    'name' => __('Sale announcement', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'offer-panel',
    'notes' => __(
        'Put the deadline in the body copy — an offer with no end date reads as a permanent price. '
        . 'This Optin is measured by clicks through to the offer, so there is nothing to submit and '
        . 'nobody is added to a list.',
        'wconvert'
    ),
    'copy' => [
        'headline' => __('Midseason sale', 'wconvert'),
        'body' => __('Everything reduced for the next three days.', 'wconvert'),
        'cta_label' => __('Shop the sale', 'wconvert'),
        'fine_print' => __('Discount applied at the checkout.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'page_load'],
    ],
];
