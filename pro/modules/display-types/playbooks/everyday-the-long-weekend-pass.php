<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-the-long-weekend-pass',
    'name' => __('The long weekend pass', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-long-weekend-pass',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Add the promised resource URL and show its acknowledgement button before publishing.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('The long weekend / getaway guide', 'wconvert-pro'), __('A little room for possibility', 'wconvert-pro'), __('The long weekend / getaway guide', 'wconvert-pro'), __('A little room for possibility', 'wconvert-pro')], 'headline' => __('Three days.
A different pace.', 'wconvert-pro'), 'body' => [['text' => __('City walks', 'wconvert-pro')], ['text' => __('Quiet corners', 'wconvert-pro')], ['text' => __('Good food', 'wconvert-pro')], ['text' => __('Our favourite short escapes, gathered in one useful guide. Leave your email to open it.', 'wconvert-pro')], ['text' => __('City walks', 'wconvert-pro')], ['text' => __('Quiet corners', 'wconvert-pro')], ['text' => __('Good food', 'wconvert-pro')]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Open my weekend guide', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('Here’s to taking the long way.', 'wconvert-pro'), 'success_body' => ['text' => __('Your request is received. Your sample weekend guide is ready to explore.', 'wconvert-pro')], 'success_action' => ['label' => __('Open the resource', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
