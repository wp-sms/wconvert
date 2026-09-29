<?php

defined('ABSPATH') || exit;

return [
    'id' => 'collection-interest',
    'name' => __('Choose a collection for shop news', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'preference-card',
    'business_types' => ['stores'],
    'notes' => __('Embed on the collection hub. Map interest in a supported destination or use saved Lead data in your follow-up process. Capture alone does not create segmentation; MailPoet mapping applies to new subscribers only.', 'wconvert'),
    'copy' => ['eyebrow'=>__('A useful starting point', 'wconvert'), 'headline'=>__('News for
your corner of home.', 'wconvert'), 'body'=>__('Choose a collection you would like to hear about in our monthly shop notes.', 'wconvert'), 'fine_print'=>[__('One optional collection preference. Monthly shop notes.', 'wconvert'), __('You can unsubscribe at any time.', 'wconvert')], 'interest_label'=>__('Which collection? (optional)', 'wconvert'), 'interest_placeholder'=>__('Choose an option', 'wconvert'), 'interest_options'=>['options'=>[['value'=>'garden', 'label'=>__('Garden and growing', 'wconvert')], ['value'=>'home', 'label'=>__('Home and everyday objects', 'wconvert')], ['value'=>'gifts', 'label'=>__('Thoughtful gifts', 'wconvert')]]], 'email_label'=>__('Email address', 'wconvert'), 'email_placeholder'=>__('you@example.com', 'wconvert'), 'consent_text'=>__('Email me monthly collection notes. I can unsubscribe anytime.', 'wconvert'), 'cta_label'=>__('Request collection notes', 'wconvert'), 'success_headline'=>__('Collection preference received', 'wconvert'), 'success_body'=>__('Thank you for requesting our monthly shop notes.', 'wconvert')],
    'rules' => [['type'=>'page_load']],
    'destination_hint' => ['types'=>[], 'fields'=>['email']],
];
