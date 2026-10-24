<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-good-dog-society',
    'name' => __('Good dog society', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-good-dog-society',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Create a valid coupon and match its value, saving and terms.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Good dog society', 'wconvert-pro'), __('Good dog society', 'wconvert-pro')], 'headline' => __('For their
very best life.', 'wconvert-pro'), 'body' => ['text' => __('Useful care tips, new finds and 10% off your first order. A little something for your favourite someone.', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Get my good-dog code', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('A treat, well deserved.', 'wconvert-pro'), 'success_body' => ['text' => __('Your request is received. Here is your first-order code.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
