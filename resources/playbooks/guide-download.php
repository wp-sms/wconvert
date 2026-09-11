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
    'notes' => __('Offer a specific resource, such as a 12-page guide. This goal counts deliveries separately from submissions. Configure a delivery destination and add the guide before publishing.', 'wconvert'),
    'copy' => [
        'headline' => __('Get the free guide', 'wconvert'),
        'body' => __('Twelve pages, no fluff. Request a copy by email.', 'wconvert'),
        'email_label' => __('Where should we send it?', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Email me the guide', 'wconvert'),
        'fine_print' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('One email with your download. See our %s.', 'wconvert'),
            'link' => ['label' => __('Privacy Policy', 'wconvert')],
        ],
        'success_headline' => __('Request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request for the guide.', 'wconvert'),
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
