<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-advent-letter',
    'name' => __('The advent letter', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'winter-advent-letter',
    'notes' => __('Collect requests for seasonal emails. Choose an email destination or Collect only. Create a valid coupon and match its discount and terms. Place the block or shortcode where this belongs.', 'wconvert'),
    'copy' => ['eyebrow' => __('THE ADVENT LETTER', 'wconvert'), 'headline' => __('Little discoveries.
A 10% welcome.', 'wconvert'), 'body' => __('Join our seasonal letters: gift inspiration and a 10% welcome code.', 'wconvert'), 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Get gift ideas + 10% off', 'wconvert'), 'consent_text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert'), 'fine_print' => __('Your code appears here after signup.', 'wconvert'), 'success_headline' => __('Thank you.
Request received.', 'wconvert'), 'success_body' => __('Here is your welcome code. Enjoy finding something lovely.', 'wconvert'), 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
