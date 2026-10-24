<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'everyday-a-curious-future',
    'name' => __('A curious future', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-a-curious-future',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Add the promised resource URL and show its acknowledgement button before publishing.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('A curious future / creative learning', 'wconvert-pro'), __('No experience. Just a little curiosity.', 'wconvert-pro'), __('A curious future / creative learning', 'wconvert-pro'), __('No experience. Just a little curiosity.', 'wconvert-pro')], 'headline' => __('What if
you tried?', 'wconvert-pro'), 'body' => ['text' => __('Short classes for people with curious minds. Get a free taster lesson and find your next small obsession.', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Try a little curiosity', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('Curiosity looks good on you.', 'wconvert-pro'), 'success_body' => ['text' => __('Your taster request is received. Explore the sample lesson below.', 'wconvert-pro')], 'success_action' => ['label' => __('Open the resource', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
