<?php

defined('ABSPATH') || exit;

return [
    'id' => 'bulk-gift-enquiry',
    'name' => __('Plan a bulk gift order', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'appointment-note',
    'business_types' => ['stores'],
    'notes' => __('Show on business gifting pages. Assign a person to discuss the order; capture does not reserve products or create a quote.', 'wconvert'),
    'copy' => ['eyebrow'=>__('For a group, with thought', 'wconvert'), 'headline'=>__('Something thoughtful.
For the whole team.', 'wconvert'), 'body'=>__('Tell us roughly how many gifts you have in mind so we can start a useful conversation.', 'wconvert'), 'interest_label'=>__('How many gifts? (optional)', 'wconvert'), 'interest_placeholder'=>__('Choose an option', 'wconvert'), 'interest_options'=>['options'=>[['value'=>'small', 'label'=>__('5–20 gifts', 'wconvert')], ['value'=>'medium', 'label'=>__('21–50 gifts', 'wconvert')], ['value'=>'large', 'label'=>__('More than 50 gifts', 'wconvert')]]], 'email_label'=>__('Email address', 'wconvert'), 'email_placeholder'=>__('you@example.com', 'wconvert'), 'consent_text'=>__('Use my email to respond to this request.', 'wconvert'), 'cta_label'=>__('Discuss a group order', 'wconvert'), 'fine_print'=>__('We use your details to respond to this request.', 'wconvert'), 'success_headline'=>__('Group order enquiry received', 'wconvert'), 'success_body'=>__('Thank you. Quantity, availability, pricing and timing still need to be confirmed.', 'wconvert')],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>['email']],
];
