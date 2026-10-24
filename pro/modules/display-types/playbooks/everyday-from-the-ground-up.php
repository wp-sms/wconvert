<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-from-the-ground-up',
    'name' => __('From the ground up', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-from-the-ground-up',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Add the promised resource URL and show its acknowledgement button before publishing.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Patch / a garden for real life', 'wconvert-pro'), __('The beginner’s growing guide', 'wconvert-pro'), __('Patch / a garden for real life', 'wconvert-pro'), __('The beginner’s growing guide', 'wconvert-pro')], 'headline' => __('Small patch.
Big possibility.', 'wconvert-pro'), 'body' => ['text' => __('A windowsill, a balcony or a little bit of earth. Start with five easy ideas for growing something of your own.', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Get the small-space guide', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'fine_print' => [['text' => __('Seasonal advice for curious beginners.', 'wconvert-pro')], ['text' => __('Seasonal advice for curious beginners.', 'wconvert-pro')]], 'success_headline' => __('A little room to grow.', 'wconvert-pro'), 'success_body' => ['text' => __('Your guide request is received. Open the sample small-space guide below.', 'wconvert-pro')], 'success_action' => ['label' => __('Open the resource', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
