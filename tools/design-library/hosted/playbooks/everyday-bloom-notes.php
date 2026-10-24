<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-bloom-notes',
    'name' => __('Bloom notes', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-bloom-notes',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Place the campaign using its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('Stem / seasonal flowers', 'wconvert'), __('Stem / seasonal flowers', 'wconvert')], 'headline' => __('A little wild.
A little wonderful.', 'wconvert'), 'body' => ['text' => __('Flowers worth knowing, simple arranging ideas and seasonal studio news. One thoughtful email a month.', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Grow my inspiration', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'success_headline' => __('A new leaf.', 'wconvert'), 'success_body' => ['text' => __('Thanks for requesting Bloom notes. We have received your details.', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
