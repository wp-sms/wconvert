<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-drop-alert',
    'name' => __('Drop Alert', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'campaign-drop-alert',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY', 'wconvert-pro'), __('UP TO / OFF', 'wconvert-pro')], 'body' => [['text' => __('%b', 'wconvert-pro'), 'emphasis' => __('40', 'wconvert-pro')], ['text' => __('%b', 'wconvert-pro'), 'emphasis' => __('%', 'wconvert-pro')], ['text' => __('Request access before the public sale opens.', 'wconvert-pro')]], 'headline' => [__('GET THE', 'wconvert-pro'), __('DROP ALERT.', 'wconvert-pro')], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'consent_text' => ['text' => __('Email me Black Friday offers. I can unsubscribe anytime.', 'wconvert-pro')], 'cta_label' => __('Get on the early list', 'wconvert-pro'), 'fine_print' => [['text' => __('Preview opens November 26. Up to 40% off selected items.', 'wconvert-pro')], ['text' => __('You can close this window and continue browsing.', 'wconvert-pro')]], 'success_headline' => __('Request received', 'wconvert-pro'), 'success_body' => ['text' => __('Thanks for requesting the Black Friday preview.', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
