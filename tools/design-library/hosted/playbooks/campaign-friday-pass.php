<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-friday-pass',
    'name' => __('Friday Pass', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'campaign-friday-pass',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['body' => [['text' => __('THE FRIDAY
PREVIEW PASS', 'wconvert')], ['text' => __('UP TO', 'wconvert')], ['text' => __('%b', 'wconvert'), 'emphasis' => __('30% OFF', 'wconvert')], ['text' => __('OPENS NOVEMBER 26', 'wconvert')], ['text' => __('Request access to selected Black Friday offers before the public opening.', 'wconvert')]], 'eyebrow' => __('BLACK FRIDAY / EARLY-ACCESS EMAIL SIGNUP', 'wconvert'), 'headline' => [__('YOUR EARLY PASS.', 'wconvert'), __('UP TO 30% OFF.', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => ['text' => __('Email me Black Friday offers. I can unsubscribe anytime.', 'wconvert')], 'cta_label' => __('Request my Friday pass', 'wconvert'), 'fine_print' => [['text' => __('Preview opens November 26. No purchase required.', 'wconvert')], ['text' => __('You can close this window and continue browsing.', 'wconvert')]], 'success_headline' => __('Request received', 'wconvert'), 'success_body' => ['text' => __('Thanks for requesting the Black Friday preview.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
