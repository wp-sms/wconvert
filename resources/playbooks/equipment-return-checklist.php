<?php

defined('ABSPATH') || exit;

return [
    'id' => 'equipment-return-checklist',
    'name' => __('Offer an equipment return checklist', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'name-and-email',
    'business_types' => ['stores', 'services'],
    'notes' => __('Use on equipment hire and return information pages. Prepare a checklist covering accessories, safe preparation and handover, then configure its resource email. Use the optional name only if you personalise the reply. The checklist does not replace the rental agreement or confirm a return.', 'wconvert'),
    'copy' => [
        'headline' => __('Ready to return your equipment?', 'wconvert'),
        'body' => __('Request a checklist for the accessories, preparation and handover details to check before you return it.', 'wconvert'),
        'name_label' => __('First name (optional)', 'wconvert'),
        'name_placeholder' => __('Your name', 'wconvert'),
        'email_label' => __('Email address', 'wconvert'),
        'email_placeholder' => __('you@example.com', 'wconvert'),
        'cta_label' => __('Request the return checklist', 'wconvert'),
        'consent_text' => __('Send me the equipment return checklist.', 'wconvert'),
        'fine_print' => __('One checklist email. No newsletter signup. Your rental terms still apply.', 'wconvert'),
        'success_headline' => __('Checklist request received', 'wconvert'),
        'success_body' => __('Thank you. We have received your request. This does not book a collection or confirm that equipment has been returned.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => ['lead_magnet_email'], 'fields' => ['email']],
];
