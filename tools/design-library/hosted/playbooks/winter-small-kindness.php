<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-small-kindness',
    'name' => __('A small kindness', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'winter-small-kindness',
    'notes' => __('Collect requests for seasonal emails. Choose an email destination or Collect only. Place the block or shortcode where this belongs.', 'wconvert'),
    'copy' => ['eyebrow' => __('A SMALL KINDNESS', 'wconvert'), 'headline' => __('Thoughtful gift ideas,
once a month.', 'wconvert'), 'body' => __('A monthly email with seasonal gift ideas and stories from our makers. A little inspiration, without the daily noise.', 'wconvert'), 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Send me monthly gift ideas', 'wconvert'), 'consent_text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert'), 'fine_print' => __('One email a month. Unsubscribe anytime.', 'wconvert'), 'success_headline' => __('Thank you.
Request received.', 'wconvert'), 'success_body' => __('Thank you for requesting our monthly gift ideas.', 'wconvert'), 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
