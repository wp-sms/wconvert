<?php

defined('ABSPATH') || exit;

return [
    'id' => 'service-process-strip',
    'name' => __('Explain the restoration enquiry process', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'service-process-strip',
    'business_types' => ['services'],
    'notes' => __('Place the block or shortcode below real service examples. Assign someone to review Leads or export. Agree assessment arrangements, scope and fees separately; this form starts a discussion and does not book work.', 'wconvert'),
    'copy' => [
        'headline' => [__('Start with the piece you want to keep.', 'wconvert'), __('Tell us', 'wconvert'), __('Assess together', 'wconvert'), __('Decide on the work', 'wconvert')],
        'body' => [__('An enquiry is the first step towards a restoration plan.', 'wconvert'), __('Leave your email so we can discuss the piece.', 'wconvert'), __('Share photos and agree what needs attention.', 'wconvert'), __('Review the scope and price before committing.', 'wconvert')],
        'eyebrow' => [__('01', 'wconvert'), __('02', 'wconvert'), __('03', 'wconvert'), __('Request received', 'wconvert')],
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'consent_text' => __('Use my email to discuss this restoration request.', 'wconvert'),
        'cta_label' => __('Ask about restoration', 'wconvert'),
        'fine_print' => __('We use your email to reply. No work is booked by this form.', 'wconvert'),
        'success_headline' => __('Restoration enquiry received', 'wconvert'),
        'success_body' => __('Thank you. The next conversation can cover the piece, photographs and a possible assessment. No work is booked.', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
