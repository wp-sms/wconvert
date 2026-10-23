<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-santa-letter',
    'name' => __('A letter from Santa', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'winter-santa-letter',
    'notes' => __('Collect requests for seasonal emails. Choose an email destination or Collect only. Create a valid coupon and match its discount and terms.', 'wconvert'),
    'copy' => ['eyebrow' => __('POST FROM THE CHRISTMAS WORKSHOP', 'wconvert'), 'headline' => __('Dear gift lover,', 'wconvert'), 'body' => [__('A little surprise from our workshop: join our emails for gift ideas and a 15% welcome code.', 'wconvert'), __('With a little Christmas magic,
The gift workshop', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Send my request', 'wconvert'), 'consent_text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert'), 'fine_print' => __('Your code appears here after signup.', 'wconvert'), 'success_headline' => __('Thank you, gift lover.', 'wconvert'), 'success_body' => __('Here is your welcome code. Enjoy finding something lovely.', 'wconvert'), 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
