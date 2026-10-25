<?php

defined('ABSPATH') || exit;

return [
    'id' => 'reader-format-choice',
    'name' => __('Choose a brief or detailed editorial letter', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'appointment-note',
    'business_types' => ['publishers'],
    'notes' => __('Show after meaningful reading. Configure a real follow-up process for each preference. Supported interest mapping is destination-specific and does not update existing MailPoet subscribers.', 'wconvert'),
    'copy' => ['eyebrow'=>__('Your reading rhythm', 'wconvert'), 'headline'=>__('A little reading.
Or a little more.', 'wconvert'), 'body'=>__('Choose a brief summary or the full editorial letter. Both arrive on our monthly schedule.', 'wconvert'), 'interest_label'=>__('How much would you like to read? (optional)', 'wconvert'), 'interest_placeholder'=>__('Choose an option', 'wconvert'), 'interest_options'=>['options'=>[['value'=>'brief', 'label'=>__('A short summary', 'wconvert')], ['value'=>'full', 'label'=>__('The full letter', 'wconvert')]]], 'email_label'=>__('Email address', 'wconvert'), 'email_placeholder'=>__('you@example.com', 'wconvert'), 'consent_text'=>__('Email me the monthly letter I requested. I can unsubscribe anytime.', 'wconvert'), 'cta_label'=>__('Request the monthly letter', 'wconvert'), 'fine_print'=>__('You can unsubscribe at any time.', 'wconvert'), 'success_headline'=>__('Reading preference received', 'wconvert'), 'success_body'=>__('Thank you for requesting the monthly letter and sharing your preference.', 'wconvert')],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>['email']],
];
