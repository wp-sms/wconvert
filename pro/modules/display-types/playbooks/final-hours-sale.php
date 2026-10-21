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
        'countdown_units' => [
            /* translators: the word under the days box of a countdown. */
            'days_label' => __('Days', 'wconvert'),
            /* translators: the word under the hours box of a countdown. */
            'hours_label' => __('Hours', 'wconvert'),
            /* translators: the word under the minutes box of a countdown; short, it sits under two digits. */
            'minutes_label' => __('Mins', 'wconvert'),
            /* translators: the word under the seconds box of a countdown; short, it sits under two digits. */
            'seconds_label' => __('Secs', 'wconvert'),
        ],
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
