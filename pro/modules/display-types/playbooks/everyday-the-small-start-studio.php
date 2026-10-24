<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'everyday-the-small-start-studio',
    'name' => __('The small-start studio', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-small-start-studio',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Add the promised resource URL and show its acknowledgement button before publishing.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('A practical creative course', 'wconvert-pro'), __('A practical creative course', 'wconvert-pro')], 'headline' => [__('You don’t need
a big beginning.', 'wconvert-pro'), __('01', 'wconvert-pro'), __('02', 'wconvert-pro'), __('03', 'wconvert-pro'), __('01', 'wconvert-pro'), __('02', 'wconvert-pro'), __('03', 'wconvert-pro')], 'body' => [['text' => __('Start with a 15-minute project. Get a free lesson and see how our workshop works.', 'wconvert-pro')], ['text' => __('Choose one small idea', 'wconvert-pro')], ['text' => __('Make a first attempt', 'wconvert-pro')], ['text' => __('See where it leads', 'wconvert-pro')], ['text' => __('Choose one small idea', 'wconvert-pro')], ['text' => __('Make a first attempt', 'wconvert-pro')], ['text' => __('See where it leads', 'wconvert-pro')]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Get the starter lesson', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('A small beginning.', 'wconvert-pro'), 'success_body' => ['text' => __('Your lesson request is received. Open the sample starter lesson below.', 'wconvert-pro')], 'success_action' => ['label' => __('Open the resource', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
