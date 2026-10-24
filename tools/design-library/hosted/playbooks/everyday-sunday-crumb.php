<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-sunday-crumb',
    'name' => __('Sunday crumb', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-sunday-crumb',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Create a valid coupon and match its value, saving and terms.', 'wconvert'),
    'copy' => ['eyebrow' => [__('A better kind of morning', 'wconvert'), __('The Sunday crumb', 'wconvert'), __('A better kind of morning', 'wconvert'), __('The Sunday crumb', 'wconvert')], 'headline' => __('Good mornings,
freshly baked.', 'wconvert'), 'body' => ['text' => __('Join our bakery notes for seasonal bakes, weekend recipes and 10% off your first order.', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Reveal my welcome code', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'success_headline' => __('A little treat for you.', 'wconvert'), 'success_body' => ['text' => __('Thanks for your interest in our bakery notes. Here is your first-order code.', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
