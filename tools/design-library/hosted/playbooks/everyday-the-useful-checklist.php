<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'everyday-the-useful-checklist',
    'name' => __('The useful checklist', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-useful-checklist',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Add the promised resource URL and show its acknowledgement button before publishing. Place the campaign using its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('A useful download', 'wconvert'), __('Inside the checklist', 'wconvert'), __('A useful download', 'wconvert'), __('Inside the checklist', 'wconvert')], 'headline' => __('Less guesswork.
A better launch.', 'wconvert'), 'body' => [['text' => __('Our 12-point website launch checklist helps you review the essentials before you press publish.', 'wconvert')], ['text' => __('01 Content & clarity', 'wconvert')], ['text' => __('02 Forms & journeys', 'wconvert')], ['text' => __('03 Mobile & accessibility', 'wconvert')], ['text' => __('04 The final checks', 'wconvert')], ['text' => __('01 Content & clarity', 'wconvert')], ['text' => __('02 Forms & journeys', 'wconvert')], ['text' => __('03 Mobile & accessibility', 'wconvert')], ['text' => __('04 The final checks', 'wconvert')]], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Open the checklist', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'success_headline' => __('Ready for a clearer launch.', 'wconvert'), 'success_body' => ['text' => __('Your request is received. Open the sample checklist below.', 'wconvert')], 'success_action' => ['label' => __('Open the resource', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
