<?php

defined('ABSPATH') || exit;

return [
    'id' => 'repair-assessment',
    'name' => __('Request a non-urgent repair assessment', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'service-docket',
    'business_types' => ['services'],
    'notes' => __('Embed on the repairs page. Assign follow-up ownership. Keep emergency instructions on the site; this form does not provide an emergency response or book a visit.', 'wconvert'),
    'copy' => ['eyebrow'=>[__('A practical first step', 'wconvert'), __('Your request', 'wconvert')], 'headline'=>__('A repair starts
with understanding it.', 'wconvert'), 'body'=>__('Choose the kind of non-urgent repair you want to discuss. We will use your email to reply.', 'wconvert'), 'fine_print'=>[__('For non-urgent repairs. No visit is booked here.', 'wconvert'), __('We use your details to respond to this request.', 'wconvert')], 'name_label'=>__('Your name (optional)', 'wconvert'), 'name_placeholder'=>__('Your name', 'wconvert'), 'email_label'=>__('Email address', 'wconvert'), 'email_placeholder'=>__('you@example.com', 'wconvert'), 'interest_label'=>__('What needs attention? (optional)', 'wconvert'), 'interest_placeholder'=>__('Choose an option', 'wconvert'), 'interest_options'=>['options'=>[['value'=>'fittings', 'label'=>__('Fixtures or fittings', 'wconvert')], ['value'=>'surfaces', 'label'=>__('Interior surfaces', 'wconvert')], ['value'=>'other', 'label'=>__('Another non-urgent repair', 'wconvert')]]], 'consent_text'=>__('Use my email to respond to this request.', 'wconvert'), 'cta_label'=>__('Request an assessment', 'wconvert'), 'success_headline'=>__('Assessment request received', 'wconvert'), 'success_body'=>__('Thank you. Your request has been received. A visit, scope and price still need to be agreed.', 'wconvert')],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>['email']],
];
