<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'studio-welcome',
    'name' => __('Welcome offer for a home and garden shop', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'studio-window',
    'notes' => __('Create a valid welcome coupon, replace the sample code and terms, and connect your email service. Review store-page targeting and frequency.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('A little room to grow', 'wconvert'), __('Your first order', 'wconvert'), __('Thank you', 'wconvert')],
        'body' => [__('Everyday objects.
A slower kind of living.', 'wconvert'), __('Join our monthly home and garden notes and reveal 10% off your first order.', 'wconvert')],
        'headline' => __('Make yourself
at home.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Email me monthly home and garden notes. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Join and reveal my code', 'wconvert'),
        'fine_print' => [__('First order only. Review the store’s offer terms before checkout.', 'wconvert'), __('First order only. Offer terms apply.', 'wconvert')],
        'success_headline' => __('A little welcome, for you.', 'wconvert'),
        'success_body' => __('Your signup request was received. Use your welcome code at checkout.', 'wconvert'),
    ],
    'rules' => [[
            'type' => 'time_on_page',
            'seconds' => 15,
        ]],
    'destination_hint' => [
        'types' => [],
        'fields' => ['email'],
    ],
];
