<?php

defined('ABSPATH') || exit;

return [
    'id' => 'excerpt-window',
    'name' => __('Let readers try a workbook exercise', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'excerpt-window',
    'business_types' => ['publishers'],
    'notes' => __('Place the inline block beside a relevant article. Create the six-exercise workbook, configure resource email and set the optional resource link. This request is not a newsletter signup.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('Try one exercise', 'wconvert'), __('Small Starts', 'wconvert')],
        'headline' => [__('Make the next step smaller.', 'wconvert'), __('Keep going with the workbook.', 'wconvert')],
        'body' => [__('Write down one task you have been putting off. Now describe its first two minutes.', 'wconvert'), __('“Sort the whole room” becomes “clear one shelf”. A small starting point makes the next action easier to see.', 'wconvert'), __('Six short exercises for turning a difficult project into a doable next step.', 'wconvert')],
        'fine_print' => [__('An exercise from the Small Starts workbook.', 'wconvert'), __('One resource email. No newsletter signup.', 'wconvert')],
        'consent_text' => __('Send me the requested workbook.', 'wconvert'),
        'cta_label' => __('Request the workbook', 'wconvert'),
        'success_headline' => __('Your request is received.', 'wconvert'),
        'success_body' => __('Thank you for requesting the workbook. Keep your first small step nearby.', 'wconvert'),
        'success_action' => ['label' => __('Open the workbook', 'wconvert')],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => ['lead_magnet_email'], 'fields' => ['email']],
];
