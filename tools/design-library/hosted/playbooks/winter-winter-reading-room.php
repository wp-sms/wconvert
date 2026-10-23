<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-winter-reading-room',
    'name' => __('The winter reading room', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'winter-winter-reading-room',
    'notes' => __('Collect requests for seasonal emails. Choose an email destination or Collect only. Create a valid coupon and match its discount and terms.', 'wconvert'),
    'copy' => ['eyebrow' => __('THE WINTER READING ROOM', 'wconvert'), 'headline' => __('Your next good book.
10% off to begin.', 'wconvert'), 'body' => __('Join our bookshop emails for winter reading picks and 10% off.', 'wconvert'), 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('', 'wconvert'), 'cta_label' => __('Get reading picks + 10% off', 'wconvert'), 'consent_text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert'), 'fine_print' => __('Your code appears here after signup.', 'wconvert'), 'success_headline' => __('Thank you.
Request received.', 'wconvert'), 'success_body' => __('Here is your welcome code. Enjoy finding something lovely.', 'wconvert'), 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
