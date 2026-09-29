<?php

defined('ABSPATH') || exit;

return [
    'id' => 'group-training-enquiry',
    'name' => __('Ask about training for a team', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'appointment-note',
    'business_types' => ['services'],
    'notes' => __('Show on team-training pages after useful engagement. Confirm goals, dates and availability separately; submitting does not enrol anyone.', 'wconvert'),
    'copy' => ['eyebrow'=>__('Learning, together', 'wconvert'), 'headline'=>__('Help your team
learn together.', 'wconvert'), 'body'=>__('Tell us the group size you have in mind. We will reply to discuss goals and suitable formats.', 'wconvert'), 'interest_label'=>__('How large is the group? (optional)', 'wconvert'), 'interest_placeholder'=>__('Choose an option', 'wconvert'), 'interest_options'=>['options'=>[['value'=>'small', 'label'=>__('2–5 people', 'wconvert')], ['value'=>'medium', 'label'=>__('6–15 people', 'wconvert')], ['value'=>'large', 'label'=>__('More than 15 people', 'wconvert')]]], 'email_label'=>__('Email address', 'wconvert'), 'email_placeholder'=>__('you@example.com', 'wconvert'), 'consent_text'=>__('Use my email to respond to this request.', 'wconvert'), 'cta_label'=>__('Discuss team training', 'wconvert'), 'fine_print'=>__('We use your details to respond to this request.', 'wconvert'), 'success_headline'=>__('Training enquiry received', 'wconvert'), 'success_body'=>__('Thank you. The training scope, date and price still need to be discussed.', 'wconvert')],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>['email']],
];
