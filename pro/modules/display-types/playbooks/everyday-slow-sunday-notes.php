<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-slow-sunday-notes',
    'name' => __('Slow Sunday notes', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-slow-sunday-notes',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Slow Sunday notes', 'wconvert-pro'), __('Slow Sunday notes', 'wconvert-pro')], 'headline' => __('Pour a cup.
Stay a while.', 'wconvert-pro'), 'body' => ['text' => __('Our monthly letter about food, rituals and small good things. Read it at your own pace.', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Get the Sunday letter', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('Thanks for spending a moment.', 'wconvert-pro'), 'success_body' => ['text' => __('Your request for Slow Sunday notes is received.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
