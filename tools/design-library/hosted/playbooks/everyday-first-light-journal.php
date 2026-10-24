<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-first-light-journal',
    'name' => __('First light journal', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-first-light-journal',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Place the campaign using its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('A little space, each week', 'wconvert'), __('First light / a quieter weekly letter', 'wconvert'), __('A little space, each week', 'wconvert'), __('First light / a quieter weekly letter', 'wconvert')], 'headline' => __('Begin where
you are.', 'wconvert'), 'body' => ['text' => __('Simple journal prompts, thoughtful reading and small ways to make room in your day.', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Get the First light letter', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'success_headline' => __('A little space to begin.', 'wconvert'), 'success_body' => ['text' => __('Your request for First light is received. Thank you for taking a moment.', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
