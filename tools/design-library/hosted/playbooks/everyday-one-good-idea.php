<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'everyday-one-good-idea',
    'name' => __('One good idea', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-one-good-idea',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording.', 'wconvert'),
    'copy' => ['eyebrow' => [__('The Friday idea', 'wconvert'), __('The Friday idea', 'wconvert')], 'headline' => __('One idea.
Every Friday.', 'wconvert'), 'body' => ['text' => __('A useful thought for people who make things. Short enough to read with your coffee.', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Make room for one idea', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'fine_print' => [['text' => __('No daily noise. Just the weekly letter.', 'wconvert')], ['text' => __('No daily noise. Just the weekly letter.', 'wconvert')]], 'success_headline' => __('An idea worth making room for.', 'wconvert'), 'success_body' => ['text' => __('Your request for The Friday idea is received. Thanks for your curiosity.', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
