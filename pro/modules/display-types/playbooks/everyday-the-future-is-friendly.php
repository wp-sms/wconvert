<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'everyday-the-future-is-friendly',
    'name' => __('The future is friendly', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-future-is-friendly',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Set a real campaign end date and match every written deadline. The countdown uses that saved date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Hello, tomorrow / new ideas for everyday life', 'wconvert-pro'), __('The launch edition', 'wconvert-pro'), __('A first look, before the launch', 'wconvert-pro'), __('Hello, tomorrow / new ideas for everyday life', 'wconvert-pro'), __('The launch edition', 'wconvert-pro'), __('A first look, before the launch', 'wconvert-pro')], 'headline' => __('Make room
for what’s next.', 'wconvert-pro'), 'body' => ['text' => __('We’re building something to make everyday work a little lighter. Request an invitation to the preview.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Request a first look', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'fine_print' => [['text' => __('A preview request, not confirmed access.', 'wconvert-pro')], ['text' => __('A preview request, not confirmed access.', 'wconvert-pro')]], 'success_headline' => __('Your first-look request is received.', 'wconvert-pro'), 'success_body' => ['text' => __('Thanks for your interest in what comes next. Preview access is not yet confirmed.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
