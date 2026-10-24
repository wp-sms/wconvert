<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-first-access-pass',
    'name' => __('First-Access Pass', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'campaign-first-access-pass',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => __('BLACK FRIDAY', 'wconvert'), 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('26', 'wconvert')], ['text' => __('NOVEMBER
ONE DAY EARLY', 'wconvert')], ['text' => __('Request entry to selected Black Friday offers before the public opening.', 'wconvert')]], 'badge' => __('UP TO 40% OFF', 'wconvert'), 'headline' => __('YOUR PASS
TO FIRST PICK.', 'wconvert'), 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => ['text' => __('Email me Black Friday offers. I can unsubscribe anytime.', 'wconvert')], 'cta_label' => __('Get early access', 'wconvert'), 'fine_print' => [['text' => __('Preview opens November 26. Selected offers.', 'wconvert')], ['text' => __('You can close this window and continue browsing.', 'wconvert')]], 'success_headline' => __('Request received', 'wconvert'), 'success_body' => ['text' => __('Thanks for requesting the Black Friday preview.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
