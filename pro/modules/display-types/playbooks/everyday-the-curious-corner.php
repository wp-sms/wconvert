<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'everyday-the-curious-corner',
    'name' => __('The curious corner', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-curious-corner',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('The curious corner / issue by issue', 'wconvert-pro'), __('The curious corner / issue by issue', 'wconvert-pro')], 'headline' => __('Not just
another email.', 'wconvert-pro'), 'body' => ['text' => __('A monthly mix of curious stories, thoughtful objects and people making something good.', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Keep my curiosity fed', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('A little more curiosity.', 'wconvert-pro'), 'success_body' => ['text' => __('Your request for The curious corner is received.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
