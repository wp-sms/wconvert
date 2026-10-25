<?php

/**
 * "Grow my email list" — the smallest ask in the library.
 *
 * A headline, a field, a button and one short policy link. The design remains
 * deliberately spare; the privacy line is the only supporting copy.
 *
 * It is the third entry under this [[Goal]] and the three do not overlap:
 * `welcome-discount` trades a discount for the address, `exit-capture` catches
 * a reader leaving, and this one asks a visitor who is already reading and
 * offers no incentive at all. A site with nothing to discount has somewhere to
 * start.
 *
 * The consent line lives on the design's `consent` node. Templates keep that
 * node hidden as a visual default; Campaign setup reveals it because this
 * Playbook grows an ongoing email list.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'one-line-invite',
    'name' => __('Simple newsletter signup', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'bold-ask',
    'notes' => __('The smallest thing that still asks. No discount, no promise beyond the one in the headline — useful when you have nothing to give away and do not want to invent something. Shows once a visitor is most of the way down the page.', 'wconvert'),
    'copy' => [
        'headline' => __('One useful idea, every week.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Send me the weekly idea', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Send me one useful idea every week. %s', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'fine_print' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Weekly emails. Unsubscribe anytime. %s', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
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
