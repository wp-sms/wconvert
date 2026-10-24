<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-the-object-room',
    'name' => __('The object room', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-object-room',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Form / furniture & objects', 'wconvert-pro'), __('The studio collection', 'wconvert-pro'), __('Form / furniture & objects', 'wconvert-pro'), __('The studio collection', 'wconvert-pro')], 'headline' => __('Objects
with a
point of view.', 'wconvert-pro'), 'body' => [['text' => __('Get first access to the new studio collection. Considered pieces, made for everyday living.', 'wconvert-pro')], ['text' => __('Coming soon', 'wconvert-pro')], ['text' => __('Coming soon', 'wconvert-pro')]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Join the preview list', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('A seat on the preview list.', 'wconvert-pro'), 'success_body' => ['text' => __('Your request is received. Thanks for taking an interest in the new collection.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
