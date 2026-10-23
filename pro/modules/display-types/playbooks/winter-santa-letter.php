<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-santa-letter',
    'name' => __('A letter from Santa', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'winter-santa-letter',
    'notes' => __('Collect requests for seasonal emails. Choose an email destination or Collect only. Create a valid coupon and match its discount and terms.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('POST FROM THE CHRISTMAS WORKSHOP', 'wconvert-pro'), 'headline' => __('Dear gift lover,', 'wconvert-pro'), 'body' => [__('A little surprise from our workshop: join our emails for gift ideas and a 15% welcome code.', 'wconvert-pro'), __('With a little Christmas magic,
The gift workshop', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Send my request', 'wconvert-pro'), 'consent_text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro'), 'fine_print' => __('Your code appears here after signup.', 'wconvert-pro'), 'success_headline' => __('Thank you, gift lover.', 'wconvert-pro'), 'success_body' => __('Here is your welcome code. Enjoy finding something lovely.', 'wconvert-pro'), 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
