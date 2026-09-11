<?php

/**
 * "Grow my email list" — the smallest ask in the library.
 *
 * A headline, a field and a button, and deliberately nothing else. The design
 * it names declares no `body` and no `fine_print` [[Slot Role]] at all, so
 * this entry could not pad it out if it wanted to — which is the point rather
 * than a limitation to work around.
 *
 * It is the third entry under this [[Goal]] and the three do not overlap:
 * `welcome-discount` trades a discount for the address, `exit-capture` catches
 * a reader leaving, and this one asks a visitor who is already reading and
 * offers no incentive at all. A site with nothing to discount has somewhere to
 * start.
 *
 * The consent line lives on the design's `consent` node, which ships hidden —
 * so a merchant who needs it switches it on and this entry does not have to
 * carry a sentence there is no slot for (ADR 0032).
 */

defined('ABSPATH') || exit;

return [
    'id' => 'one-line-invite',
    'name' => __('One line, one field', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'one-line-signup',
    'notes' => __('The smallest thing that still asks. No discount, no promise beyond the one in the headline — useful when you have nothing to give away and do not want to invent something. Shows once a visitor is most of the way down the page.', 'wconvert'),
    'copy' => [
        'headline' => __('One email a week. That is all.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Subscribe', 'wconvert'),
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you for asking to receive the next issue.', 'wconvert'),
    ],
    // Sixty per cent, rather than the fifty `guide-download` uses: this offers
    // nothing in exchange, so it waits until a visitor is further in.
    'rules' => [
        ['type' => 'scroll_depth', 'percent' => 60],
    ],
    'destination_hint' => [
        'types' => ['wsms', 'email_service_provider'],
        'fields' => ['email'],
    ],
];
