<?php

defined('ABSPATH') || exit;

return [
    'id' => 'reader-question',
    'name' => __('Send an editorial question', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'inline-choice',
    'business_types' => ['publishers'],
    'notes' => __('Embed on the editorial contact page. Use the supported topic choice and email; a longer message can be requested in the follow-up. No public posting or publication is promised.', 'wconvert'),
    'copy' => ['headline'=>__('What would you
like us to explore?', 'wconvert'), 'body'=>__('Choose a topic and leave your email. The editorial team can reply to continue the conversation.', 'wconvert'), 'name_label'=>__('Your name (optional)', 'wconvert'), 'name_placeholder'=>__('Alex Morgan', 'wconvert'), 'email_label'=>__('Email address', 'wconvert'), 'email_placeholder'=>__('you@example.com', 'wconvert'), 'interest_label'=>__('Choose a topic (optional)', 'wconvert'), 'interest_placeholder'=>__('Choose an option', 'wconvert'), 'interest_options'=>['options'=>[['value'=>'writing', 'label'=>__('Writing and editing', 'wconvert')], ['value'=>'ideas', 'label'=>__('Ideas for a future article', 'wconvert')], ['value'=>'publication', 'label'=>__('About the publication', 'wconvert')]]], 'cta_label'=>__('Start an editorial conversation', 'wconvert'), 'consent_text'=>__('Use my email to respond to this request.', 'wconvert'), 'fine_print'=>__('We use your details to respond to this request.', 'wconvert'), 'success_headline'=>__('Editorial enquiry received', 'wconvert'), 'success_body'=>__('Thank you. Your topic and contact details have been received. Nothing has been posted publicly.', 'wconvert')],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>['email']],
];
