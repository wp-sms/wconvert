<?php

/**
 * "Deliver a lead magnet" — a file in exchange for an address.
 *
 * The same design as the discount Playbook, with different words. That is the
 * boundary ADR 0010 draws working as intended: copy is what makes an Optin
 * serve a particular Goal, so with the copy held here a Template stays
 * goal-agnostic and the library stays small.
 */

defined('ABSPATH') || exit;

return [
    'id' => 'guide-download',
    'name' => __('Guide download', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'centred-card',
    'notes' => __(
        'Name the thing being sent, not the act of sending it — "the 12-page guide" converts better than '
        . '"our newsletter". The headline number for this Goal is deliveries rather than submissions, so '
        . 'a bad address shows up as the gap between the two.',
        'wconvert'
    ),
    'copy' => [
        'headline' => __('Get the free guide', 'wconvert'),
        'body' => __('Twelve pages, no fluff. We will email it over right away.', 'wconvert'),
        'email_label' => __('Where should we send it?', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Email me the guide', 'wconvert'),
        'fine_print' => [
            'text' => __('One email with your download. See our %s.', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'success_headline' => __('On its way', 'wconvert'),
        'success_body' => __('Check your inbox in the next minute or two.', 'wconvert'),
    ],
    // Half way down is where someone has decided the page is worth reading,
    // which is the moment a guide about it is worth offering.
    'rules' => [
        ['type' => 'scroll_depth', 'percent' => 50],
    ],
    'destination_hint' => [
        'types' => ['lead_magnet_email'],
        'fields' => ['email'],
    ],
];
