<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-small-batch-bulletin',
    'name' => __('Small batch bulletin', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-small-batch-bulletin',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Place the campaign using its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('Batch 04', 'wconvert'), __('Notes from the workshop', 'wconvert'), __('Batch 04', 'wconvert'), __('Notes from the workshop', 'wconvert')], 'headline' => __('Made slowly.
Arriving soon.', 'wconvert'), 'body' => [['text' => __('Our next run of handmade tableware is nearly ready. Request a preview of the pieces before launch.', 'wconvert')], ['text' => __('Material', 'wconvert')], ['text' => __('Stoneware', 'wconvert')], ['text' => __('Finish', 'wconvert')], ['text' => __('Glazed by hand', 'wconvert')], ['text' => __('Material', 'wconvert')], ['text' => __('Stoneware', 'wconvert')], ['text' => __('Finish', 'wconvert')], ['text' => __('Glazed by hand', 'wconvert')]], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Request the preview', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'success_headline' => __('A note for the next batch.', 'wconvert'), 'success_body' => ['text' => __('Your preview request is received. Thank you for your interest in handmade work.', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
