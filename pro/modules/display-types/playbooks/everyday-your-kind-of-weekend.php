<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-your-kind-of-weekend',
    'name' => __('Your kind of weekend', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-your-kind-of-weekend',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Around here / the local letter', 'wconvert-pro'), __('Around here / the local letter', 'wconvert-pro')], 'headline' => [__('Less scrolling.
More going.', 'wconvert-pro'), __('Eat.', 'wconvert-pro'), __('See.', 'wconvert-pro'), __('Do.', 'wconvert-pro'), __('Eat.', 'wconvert-pro'), __('See.', 'wconvert-pro'), __('Do.', 'wconvert-pro')], 'body' => ['text' => __('A handful of good things happening nearby. Independent places, local events and reasons to step outside.', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Find my next weekend', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('A good reason to get out.', 'wconvert-pro'), 'success_body' => ['text' => __('Your request for the local letter is received. Thanks for exploring with us.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
