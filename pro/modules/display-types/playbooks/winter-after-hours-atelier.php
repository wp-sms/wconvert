<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-after-hours-atelier',
    'name' => __('After-hours at the atelier', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'winter-after-hours-atelier',
    'notes' => __('Collect requests for seasonal emails. Choose an email destination or Collect only. Create a valid coupon and match its discount and terms.', 'wconvert'),
    'copy' => ['eyebrow' => __('AFTER HOURS AT THE ATELIER', 'wconvert'), 'headline' => __('First pick.
15% off your first order.', 'wconvert'), 'body' => __('Join our emails to hear about new winter pieces and reveal 15% off.', 'wconvert'), 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Join the list + get 15% off', 'wconvert'), 'consent_text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert'), 'fine_print' => __('Your code appears here after signup.', 'wconvert'), 'success_headline' => __('Thank you.
Request received.', 'wconvert'), 'success_body' => __('Here is your welcome code. Enjoy finding something lovely.', 'wconvert'), 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
