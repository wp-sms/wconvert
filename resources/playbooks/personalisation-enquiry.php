<?php

defined('ABSPATH') || exit;

return [
    'id' => 'personalisation-enquiry',
    'name' => __('Ask about a custom product', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'inline-choice',
    'business_types' => ['stores'],
    'notes' => __('Embed beside personalization information. Inline replaces the planned slide-in so the existing choice design can capture the request type without a near-duplicate design.', 'wconvert'),
    'copy' => ['headline'=>__('Make it
a little more personal.', 'wconvert'), 'body'=>__('Choose the kind of personalization you are considering. We will reply about the possibilities.', 'wconvert'), 'name_label'=>__('Your name (optional)', 'wconvert'), 'name_placeholder'=>__('Alex Morgan', 'wconvert'), 'email_label'=>__('Email address', 'wconvert'), 'email_placeholder'=>__('you@example.com', 'wconvert'), 'interest_label'=>__('What are you considering? (optional)', 'wconvert'), 'interest_placeholder'=>__('Choose an option', 'wconvert'), 'interest_options'=>['options'=>[['value'=>'initials', 'label'=>__('Initials or a short name', 'wconvert')], ['value'=>'finish', 'label'=>__('A different finish', 'wconvert')], ['value'=>'bespoke', 'label'=>__('A bespoke detail', 'wconvert')]]], 'cta_label'=>__('Ask about personalization', 'wconvert'), 'consent_text'=>__('Use my email to respond to this request.', 'wconvert'), 'fine_print'=>__('We use your details to respond to this request.', 'wconvert'), 'success_headline'=>__('Personalization enquiry received', 'wconvert'), 'success_body'=>__('Thank you. We have received your request. Specifications and availability still need to be discussed.', 'wconvert')],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>['email']],
];
