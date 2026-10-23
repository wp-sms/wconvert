<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-bright-new-chapter',
    'name' => __('A bright new chapter', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'winter-bright-new-chapter',
    'notes' => __('Collect requests for seasonal emails. Choose an email destination or Collect only. Create a valid coupon and match its discount and terms.', 'wconvert'),
    'copy' => ['eyebrow' => __('HERE’S TO WHAT COMES NEXT', 'wconvert'), 'headline' => __('A new chapter.
A 15% welcome.', 'wconvert'), 'body' => __('Join our January emails for new arrivals and a 15% welcome code.', 'wconvert'), 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('', 'wconvert'), 'cta_label' => __('Get January arrivals + 15% off', 'wconvert'), 'consent_text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert'), 'fine_print' => __('Your code appears here after signup.', 'wconvert'), 'success_headline' => __('Thank you.
Request received.', 'wconvert'), 'success_body' => __('Here is your welcome code. Enjoy finding something lovely.', 'wconvert'), 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
