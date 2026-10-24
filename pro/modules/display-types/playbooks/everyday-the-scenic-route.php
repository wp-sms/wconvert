<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-the-scenic-route',
    'name' => __('The scenic route', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-scenic-route',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Add the promised resource URL and show its acknowledgement button before publishing.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Sidequest / alternative city guides', 'wconvert-pro'), __('Walk a little', 'wconvert-pro'), __('Notice more', 'wconvert-pro'), __('Sidequest / alternative city guides', 'wconvert-pro'), __('Walk a little', 'wconvert-pro'), __('Notice more', 'wconvert-pro')], 'headline' => __('Take the
scenic route.', 'wconvert-pro'), 'body' => ['text' => __('Our free city-walk sampler helps you find the small places worth slowing down for.', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Open the walk sampler', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('The long way is waiting.', 'wconvert-pro'), 'success_body' => ['text' => __('Your request is received. Open the sample city walk below.', 'wconvert-pro')], 'success_action' => ['label' => __('Open the resource', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
