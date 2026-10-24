<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-soft-science',
    'name' => __('Soft science', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-soft-science',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Soft science / daily care', 'wconvert-pro'), __('The first look', 'wconvert-pro'), __('Soft science / daily care', 'wconvert-pro'), __('The first look', 'wconvert-pro')], 'body' => [['text' => __('Less, but considered.', 'wconvert-pro')], ['text' => __('Explore our new daily-care collection. Join the launch list for product notes and a preview of the range.', 'wconvert-pro')], ['text' => __('Less, but considered.', 'wconvert-pro')]], 'headline' => __('A simpler
kind of ritual.', 'wconvert-pro'), 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Explore what’s next', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('A considered beginning.', 'wconvert-pro'), 'success_body' => ['text' => __('Thanks for your interest. Your request for the collection preview is received.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
