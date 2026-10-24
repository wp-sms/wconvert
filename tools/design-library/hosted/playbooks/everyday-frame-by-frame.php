<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'everyday-frame-by-frame',
    'name' => __('Frame by frame', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-frame-by-frame',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Place the campaign using its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('Contact sheet / a photography letter', 'wconvert'), __('Made for curious eyes', 'wconvert'), __('Contact sheet / a photography letter', 'wconvert'), __('Made for curious eyes', 'wconvert')], 'headline' => __('Look longer.
See more.', 'wconvert'), 'body' => ['text' => __('One photo story. One practical idea. Every other Friday.', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Get the next issue', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'success_headline' => __('A fresh perspective.', 'wconvert'), 'success_body' => ['text' => __('We received your request for Contact sheet. Thanks for looking a little closer.', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
