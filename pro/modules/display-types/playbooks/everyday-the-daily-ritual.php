<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-the-daily-ritual',
    'name' => __('The daily ritual', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-daily-ritual',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Add the promised resource URL and show its acknowledgement button before publishing.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('The daily ritual', 'wconvert-pro'), __('The daily ritual', 'wconvert-pro')], 'headline' => __('Your next
favourite cup.', 'wconvert-pro'), 'body' => ['text' => __('Get our brew guide and a first look at new roasts. Good coffee, without the guesswork.', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Get the brew guide', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('Make time for a good cup.', 'wconvert-pro'), 'success_body' => ['text' => __('Your guide request is received. Open the sample brew notes below.', 'wconvert-pro')], 'success_action' => ['label' => __('Open the resource', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
