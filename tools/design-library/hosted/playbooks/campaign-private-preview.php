<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-private-preview',
    'name' => __('Private Preview', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'campaign-private-preview',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['body' => [['text' => __('V
I
P', 'wconvert')], ['text' => __('Request access to selected Black Friday offers on November 26, one day before the public sale.', 'wconvert')]], 'eyebrow' => [__('EARLY ACCESS
NOVEMBER 26', 'wconvert'), __('BLACK FRIDAY / EARLY-ACCESS SIGNUP', 'wconvert')], 'headline' => [__('FIRST ACCESS.', 'wconvert'), __('UP TO 30% OFF.', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => ['text' => __('Email me Black Friday offers. I can unsubscribe anytime.', 'wconvert')], 'cta_label' => __('Request early access', 'wconvert'), 'fine_print' => [['text' => __('Access opens November 26. Selected items. No purchase required.', 'wconvert')], ['text' => __('You can close this window and continue browsing.', 'wconvert')]], 'success_headline' => __('Request received', 'wconvert'), 'success_body' => ['text' => __('Thanks for requesting the Black Friday preview.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
