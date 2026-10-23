<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-bright-new-chapter',
    'name' => __('A bright new chapter', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'winter-bright-new-chapter',
    'notes' => __('Collect requests for seasonal emails. Choose an email destination or Collect only. Create a valid coupon and match its discount and terms.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('HERE’S TO WHAT COMES NEXT', 'wconvert-pro'), 'headline' => __('A new chapter.
A 15% welcome.', 'wconvert-pro'), 'body' => __('Join our January emails for new arrivals and a 15% welcome code.', 'wconvert-pro'), 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Get January arrivals + 15% off', 'wconvert-pro'), 'consent_text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro'), 'fine_print' => __('Your code appears here after signup.', 'wconvert-pro'), 'success_headline' => __('Thank you.
Request received.', 'wconvert-pro'), 'success_body' => __('Here is your welcome code. Enjoy finding something lovely.', 'wconvert-pro'), 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
