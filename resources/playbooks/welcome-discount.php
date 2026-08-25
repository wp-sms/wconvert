<?php

/**
 * "Grow my email list" — the discount-for-an-address trade.
 *
 * Words only. Everything here is snapshotted into the Optin at prefill and the
 * two never speak again, so improving this file never rewrites a running
 * Optin (CONTEXT.md, Playbook).
 */

defined('ABSPATH') || exit;

return [
    'id' => 'welcome-discount',
    'name' => __('Welcome discount', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'centred-card',
    'notes' => __(
        'A first-order discount is the highest-converting trade there is, because the visitor gets '
        . 'something back in the same session. Keep the discount in the headline where it is read first.',
        'wconvert'
    ),
    'copy' => [
        'headline' => __('Get 10% off your first order', 'wconvert'),
        'body' => __('Join the list and we will send the code straight over.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Send my code', 'wconvert'),
        /*
         * The link carries a LABEL and no destination, which is the one shape
         * only the site can complete: the renderer fills the href from
         * `get_privacy_policy_url()` at render time, so this entry is correct
         * on every install without knowing which install it is on (ADR 0032).
         */
        'fine_print' => [
            'text' => __('No spam, and you can unsubscribe at any time. See our %s.', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'success_headline' => __('You are on the list', 'wconvert'),
        'success_body' => __('Your code is on its way to your inbox.', 'wconvert'),
    ],
    // Eight seconds is long enough to have read something and short enough to
    // still be on the page. One Trigger and not `page_load` beside it: an
    // Optin fires when ANY of its Triggers fires (CONTEXT.md, Trigger), so
    // adding `page_load` would show the popup immediately and delete the
    // timer rather than backing it up.
    'rules' => [
        ['type' => 'time_on_page', 'value' => 8],
    ],
    'destination_hint' => [
        'types' => ['wsms', 'email_service_provider'],
        'fields' => ['email'],
    ],
];
