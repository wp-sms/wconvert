<?php

/** A curated starting point; site-specific details are completed by the merchant. */

defined('ABSPATH') || exit;

return [
    'id' => 'final-hours-sale',
    'name' => __('Last hours of a sale, with the code on screen', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'last-call',
    'business_types' => ['stores'],
    'notes' => __('A fullscreen countdown for the final hours of a real sale. Set the genuine end date in Schedule; the countdown stays empty until you do. Create a valid 30% code, enter it on the code screen and connect your email service. Shows as a visitor goes to leave; exclude checkout.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('Last call', 'wconvert'),
            __('Last call', 'wconvert'),
        ],
        'headline' => __('30% off everything
ends in', 'wconvert'),
        'body' => __('Leave your email and your code
appears on the next screen.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => [
            /* translators: %s: the label of a link to the site's privacy policy. */
            'text' => __('Email me sale news and offers. %s', 'wconvert'),
            'link' => [
                'label' => __('Privacy Policy', 'wconvert'),
            ],
        ],
        'cta_label' => __('Show my code', 'wconvert'),
        'success_headline' => __('Here is your code', 'wconvert'),
        'success_body' => __('Use it at the checkout
before the timer runs out.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'exit_intent'],
    ],
    'destination_hint' => ['types' => ['wsms', 'email_service_provider'], 'fields' => ['email']],
];
