<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'halloween-treat-signup',
    'name' => __('Halloween treat signup', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'halloween-monster',
    'notes' => __('Invite email signups and reveal an offer code. Create a valid first-order coupon, match the discount and terms, and choose an email destination or Collect only.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('NO TRICKS. JUST TREATS.', 'wconvert'), __('A LITTLE SOMETHING FOR YOU', 'wconvert')],
        'headline' => __('Bite into
25% off.', 'wconvert'),
        'body' => __('Join the list. Reveal your first-order code.', 'wconvert'),
        'consent_text' => __('Email me offers and new arrivals. I can unsubscribe anytime.', 'wconvert'),
        'cta_label' => __('Reveal my treat', 'wconvert'),
        /* translators: %s: a link to the site's privacy policy. */
        'fine_print' => [['text' => __('Offers by email. Unsubscribe anytime. %s', 'wconvert'), 'link' => ['label' => __('Privacy Policy', 'wconvert')]], __('First order only. Selected items.', 'wconvert')],
        'success_headline' => __('Your treat
is here.', 'wconvert'),
        'success_body' => __('Thanks for sharing your details. Use this code on your first order.', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
