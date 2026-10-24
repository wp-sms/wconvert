<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['services'],
    'id' => 'everyday-build-something-good',
    'name' => __('Build something good', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-build-something-good',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Set a real campaign end date and match every written deadline. The countdown uses that saved date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Workbench / early access', 'wconvert-pro'), __('Preview requests close in', 'wconvert-pro'), __('Workbench / early access', 'wconvert-pro')], 'headline' => __('An idea is
a good start.', 'wconvert-pro'), 'body' => ['text' => __('A calmer workspace for your next project. Join the early-access list and help shape what comes next.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Request early access', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'fine_print' => [['text' => __('An invitation request, not a confirmed account.', 'wconvert-pro')], ['text' => __('An invitation request, not a confirmed account.', 'wconvert-pro')]], 'success_headline' => __('A good place to begin.', 'wconvert-pro'), 'success_body' => ['text' => __('Your early-access request is received. We’ll email you when access opens.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
