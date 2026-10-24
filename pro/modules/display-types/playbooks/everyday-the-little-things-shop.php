<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-the-little-things-shop',
    'name' => __('The little-things shop', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-little-things-shop',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Create a valid coupon and match its value, saving and terms.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('The little-things shop', 'wconvert-pro'), __('The little-things shop', 'wconvert-pro')], 'headline' => [__('Little things.
Big joy.', 'wconvert-pro'), __('10% off', 'wconvert-pro'), __('10% off', 'wconvert-pro')], 'body' => ['text' => __('Your first order of everyday good things.', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Reveal my little welcome', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'fine_print' => [['text' => __('First orders only. Excludes gift cards.', 'wconvert-pro')], ['text' => __('First orders only. Excludes gift cards.', 'wconvert-pro')]], 'success_headline' => __('A little welcome, just here.', 'wconvert-pro'), 'success_body' => ['text' => __('Your request is received. Here is your first-order code.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
