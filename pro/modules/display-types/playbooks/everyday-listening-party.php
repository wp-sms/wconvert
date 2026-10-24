<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'everyday-listening-party',
    'name' => __('Listening party', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-listening-party',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Set a real campaign end date and match every written deadline. The countdown uses that saved date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Low volume / high feeling', 'wconvert-pro'), __('Listening room 01', 'wconvert-pro'), __('Preview list closes in', 'wconvert-pro'), __('Low volume / high feeling', 'wconvert-pro'), __('Listening room 01', 'wconvert-pro')], 'headline' => __('Good things
sound different.', 'wconvert-pro'), 'body' => ['text' => __('Meet our new headphones. Join the preview before the collection opens.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Put me on the list', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('We have your request.', 'wconvert-pro'), 'success_body' => ['text' => __('Thanks for your interest in the collection. Take a moment to enjoy the quiet.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
