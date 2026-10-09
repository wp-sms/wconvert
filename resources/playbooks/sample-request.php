<?php

defined('ABSPATH') || exit;

return [
    'id' => 'sample-request',
    'name' => __('Ask for a material sample', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'inline-choice',
    'business_types' => ['stores'],
    'notes' => __('Embed beside the material selector. Configure who replies; this is a sample enquiry, not an order or dispatch confirmation.', 'wconvert'),
    'copy' => ['headline'=>__('A sample before
a decision.', 'wconvert'), 'body'=>__('Tell us which material you are considering. We will reply about sample availability.', 'wconvert'), 'name_label'=>__('Your name (optional)', 'wconvert'), 'name_placeholder'=>__('Alex Morgan', 'wconvert'), 'email_label'=>__('Email address', 'wconvert'), 'email_placeholder'=>__('you@example.com', 'wconvert'), 'interest_label'=>__('Which material? (optional)', 'wconvert'), 'interest_placeholder'=>__('Choose an option', 'wconvert'), 'interest_options'=>['options'=>[['value'=>'fabric', 'label'=>__('Fabric', 'wconvert')], ['value'=>'wood', 'label'=>__('Wood finish', 'wconvert')], ['value'=>'colour', 'label'=>__('Colour sample', 'wconvert')]]], 'cta_label'=>__('Request sample details', 'wconvert'), 'consent_text'=>__('Use my email to respond to this request.', 'wconvert'), 'fine_print'=>__('We use your details to respond to this request.', 'wconvert'), 'success_headline'=>__('Sample enquiry received', 'wconvert'), 'success_body'=>__('Thank you. We have received your sample enquiry. Availability and any delivery details still need to be agreed.', 'wconvert')],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>['email']],
];
