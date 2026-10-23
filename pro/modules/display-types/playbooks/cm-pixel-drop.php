<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-pixel-drop',
    'name' => __('Pixel drop', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'cm-pixel-drop',
    'notes' => __('Reveal a coupon after a required email signup. Set a valid coupon and matching discount, and choose an email destination or Collect only.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [__('CYBER MONDAY / BONUS DROP', 'wconvert-pro'), __('YOUR OFFER', 'wconvert-pro')],
        'headline' => __('NEW LEVEL.
LESS SPEND.', 'wconvert-pro'),
        'body' => __('Enter your email. Unlock your 20% off code.', 'wconvert-pro'),
        'email_label' => __('Email address', 'wconvert-pro'),
        'email_placeholder' => '',
        'consent_text' => __('Email me offers and new arrivals. I can unsubscribe anytime.', 'wconvert-pro'),
        'cta_label' => __('Unlock my bonus', 'wconvert-pro'),
        /* translators: %s: a link to the site privacy policy. */
        'fine_print' => [['text' => __('Offers by email. Unsubscribe anytime. %s', 'wconvert-pro'), 'link' => ['label' => __('Privacy Policy', 'wconvert-pro')]], __('Selected items. Offer terms apply.', 'wconvert-pro')],
        'success_headline' => __('Request received.', 'wconvert-pro'),
        'success_body' => __('Thanks for requesting the offer. Here is your code.', 'wconvert-pro'),
        'close_label' => __('Continue browsing', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
