<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'everyday-school-of-small-things',
    'name' => __('School of small things', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-school-of-small-things',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Add the promised resource URL and show its acknowledgement button before publishing. Place the campaign using its block or shortcode.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('An hour for a new idea', 'wconvert-pro'), __('An hour for a new idea', 'wconvert-pro')], 'headline' => __('Stay curious.
Start small.', 'wconvert-pro'), 'body' => ['text' => __('Try our free drawing warm-ups: five short exercises to help you put pencil to paper.', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Show me the exercises', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'fine_print' => [['text' => __('No perfect drawings required.', 'wconvert-pro')], ['text' => __('No perfect drawings required.', 'wconvert-pro')]], 'success_headline' => __('Your next line starts here.', 'wconvert-pro'), 'success_body' => ['text' => __('Your request is received. The sample exercise preview is available below.', 'wconvert-pro')], 'success_action' => ['label' => __('Open the resource', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
