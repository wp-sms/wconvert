<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-first-light-access',
    'name' => __('First light access', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'winter-first-light-access',
    'notes' => __('Collect requests for seasonal emails. Choose an email destination or Collect only. Create a valid coupon and match its discount and terms. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['eyebrow' => __('THE WINTER PREVIEW', 'wconvert'), 'headline' => __('Winter previews.
A 15% welcome.', 'wconvert'), 'body' => __('Request winter-preview emails before 1 December and reveal a 15% code.', 'wconvert'), 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('', 'wconvert'), 'cta_label' => __('Get early access + 15% off', 'wconvert'), 'consent_text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert'), 'fine_print' => __('Your code appears here after signup.', 'wconvert'), 'success_headline' => __('Thank you.
Request received.', 'wconvert'), 'success_body' => __('Here is your welcome code. Enjoy finding something lovely.', 'wconvert'), 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
