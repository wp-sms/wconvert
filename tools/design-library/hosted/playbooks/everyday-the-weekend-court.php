<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-the-weekend-court',
    'name' => __('The weekend court', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-weekend-court',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Add the promised resource URL and show its acknowledgement button before publishing. Place the campaign using its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('The weekend court', 'wconvert'), __('The weekend court', 'wconvert')], 'headline' => __('More outside.
More good days.', 'wconvert'), 'body' => ['text' => __('Get our beginner’s guide to your first tennis session. What to bring, a few simple drills and where to begin.', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Open the starter guide', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'success_headline' => __('A good place to start.', 'wconvert'), 'success_body' => ['text' => __('Your guide request is received. Open the sample starter guide below.', 'wconvert')], 'success_action' => ['label' => __('Open the resource', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
