<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-cyber-club',
    'name' => __('The cyber club', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'cm-cyber-club',
    'notes' => __('Reveal a coupon after a required email signup. Set a valid coupon and matching discount, and choose an email destination or Collect only. Place the block or shortcode where the offer belongs.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('THE CYBER MONDAY CLUB', 'wconvert'), __('YOUR NEXT FAVOURITE', 'wconvert'), __('YOUR OFFER', 'wconvert')],
        'headline' => [__('A very good day
to be on the list.', 'wconvert'), __('25%', 'wconvert'), __('Make yourself
at home.', 'wconvert')],
        'body' => [__('A little less. A lot to love.', 'wconvert'), __('Join our email list and reveal 25% off selected pieces.', 'wconvert')],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => '',
        'consent_text' => __('Email me offers and new arrivals. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Count me in', 'wconvert'),
        /* translators: %s: a link to the site privacy policy. */
        'fine_print' => [['text' => __('Offers by email. Unsubscribe anytime. %s', 'wconvert'), 'link' => ['label' => __('Privacy Policy', 'wconvert')]], __('Selected items. Offer terms apply.', 'wconvert')],
        'success_headline' => __('Request received.', 'wconvert'),
        'success_body' => __('Thanks for requesting the offer. Here is your code.', 'wconvert'),
        'close_label' => __('Continue browsing', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
