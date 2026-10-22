<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-early-list',
    'name' => __('The early list', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'bf-early-list',
    'notes' => __('Reveal a coupon after a required email signup. Set a valid coupon and matching discount, and choose an email destination or Collect only.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('YOU’RE ON THE INVITE LIST', 'wconvert'), __('YOUR EARLY-ACCESS PASS', 'wconvert'), __('YOUR OFFER', 'wconvert')],
        'headline' => __('Black Friday.
Before the crowd.', 'wconvert'),
        'body' => __('Join the early list. Get 25% off selected favourites.', 'wconvert'),
        'badge' => __('FIRST IN LINE', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => '',
        'consent_text' => __('Email me offers and new arrivals. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Get my early-access code', 'wconvert'),
        /* translators: %s: a link to the site privacy policy. */
        'fine_print' => [['text' => __('Offers by email. Unsubscribe anytime. %s', 'wconvert'), 'link' => ['label' => __('Privacy Policy', 'wconvert')]], __('Selected items. Offer terms apply.', 'wconvert')],
        'success_headline' => __('Request received.', 'wconvert'),
        'success_body' => __('Thanks for requesting the offer. Here is your code.', 'wconvert'),
        'close_label' => __('Continue browsing', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
