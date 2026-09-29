<?php

defined('ABSPATH') || exit;

return [
    'id' => 'pre-visit-checklist',
    'name' => __('Prepare for a service consultation', 'wconvert'),
    'goal' => 'deliver_lead_magnet',
    'template_id' => 'resource-index',
    'business_types' => ['services'],
    'notes' => __('Embed below the consultation description. Supply the actual checklist and immediate resource link, plus a configured resource-email destination. Do not ask visitors to send sensitive records through the form.', 'wconvert'),
    'copy' => ['success_action' => __('Open the checklist', 'wconvert'),'eyebrow'=>[__('The consultation checklist', 'wconvert'), __('01', 'wconvert'), __('02', 'wconvert'), __('03', 'wconvert')], 'headline'=>__('Make the first
conversation useful.', 'wconvert'), 'body'=>[__('Gather your priorities, practical constraints and questions before an initial consultation.', 'wconvert'), __('List your priorities', 'wconvert'), __('Note practical constraints', 'wconvert'), __('Prepare useful questions', 'wconvert')], 'email_label'=>__('Email address', 'wconvert'), 'email_placeholder'=>__('you@example.com', 'wconvert'), 'consent_text'=>__('Use my email to respond to this request.', 'wconvert'), 'cta_label'=>__('Request the consultation checklist', 'wconvert'), 'fine_print'=>__('One resource email. No newsletter signup.', 'wconvert'), 'success_headline'=>__('Checklist request received', 'wconvert'), 'success_body'=>__('Thank you for requesting the consultation checklist.', 'wconvert')],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>['lead_magnet_email'], 'fields'=>['email']],
];
