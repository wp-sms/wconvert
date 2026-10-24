<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-first-dibs-signup',
    'name' => __('First-Dibs Signup', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'campaign-first-dibs-signup',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['body' => ['text' => __('%b', 'wconvert-pro'), 'emphasis' => __('26', 'wconvert-pro')], 'eyebrow' => [__('NOV / EARLY ACCESS', 'wconvert-pro'), __('BLACK FRIDAY / EARLY ACCESS SIGNUP BAR', 'wconvert-pro')], 'headline' => __('FIRST PICK.
UP TO 40% OFF.', 'wconvert-pro'), 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Get first dibs', 'wconvert-pro'), 'consent_text' => ['text' => __('Email me Black Friday offers. I can unsubscribe anytime.', 'wconvert-pro')], 'fine_print' => [['text' => __('Preview opens November 26. Up to 40% off selected items.', 'wconvert-pro')], ['text' => __('You can close this window and continue browsing.', 'wconvert-pro')]], 'success_headline' => __('Request received', 'wconvert-pro'), 'success_body' => ['text' => __('Thanks for requesting the Black Friday preview.', 'wconvert-pro')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
