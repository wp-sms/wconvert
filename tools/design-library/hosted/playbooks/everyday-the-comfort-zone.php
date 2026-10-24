<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-the-comfort-zone',
    'name' => __('The comfort zone', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-comfort-zone',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Create a valid coupon and match its value, saving and terms.', 'wconvert'),
    'copy' => ['eyebrow' => [__('The comfort zone', 'wconvert'), __('The comfort zone', 'wconvert')], 'headline' => __('A softer
landing.', 'wconvert'), 'body' => ['text' => __('Ideas for a calmer home, a few lovely finds and 10% off your first order.', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Find my comfort code', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'success_headline' => __('Make yourself comfortable.', 'wconvert'), 'success_body' => ['text' => __('Your request is received. Here is your first-order code.', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
