<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'bakery-first-loaf',
    'name' => __('A free first loaf for the Friday list', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'tasting-card',
    'business_types' => ['stores'],
    'notes' => __('For bakeries and delis: a free loaf with a first order for joining a weekly list. Create a valid single-use code, enter it on the code screen, and say whether it works in the shop, online or both. Connect your email service before publishing.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('From the bakery', 'wconvert'),
        'headline' => __('Your first loaf
is on us', 'wconvert'),
        'body' => __('Join the Friday list for the week’s bakes, and take a free loaf with your first order.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Claim my free loaf', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Email me the Friday bakes. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'success_headline' => __('Your free-loaf code', 'wconvert'),
        'success_body' => __('Add it at the checkout,
or show it at the counter.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'time_on_page', 'seconds' => 10],
    ],
    'destination_hint' => ['types' => ['email_service_provider'], 'fields' => ['email']],
];
