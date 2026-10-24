<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-wishlist-alert',
    'name' => __('Wishlist Alert', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'campaign-wishlist-alert',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('THE WISHLIST EDIT / BLACK FRIDAY PREVIEW', 'wconvert'), __('BLACK FRIDAY / EARLY-ACCESS EMAIL SIGNUP', 'wconvert')], 'body' => [['text' => __('The preview opens November 26.', 'wconvert')], ['text' => __('What is the offer?', 'wconvert')], ['text' => __('Up to 30% off selected favourites.', 'wconvert')], ['text' => __('Request the November 26 preview of selected Black Friday offers.', 'wconvert')]], 'headline' => __('FIRST LOOK.
UP TO 30% OFF.', 'wconvert'), 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => ['text' => __('Email me Black Friday offers. I can unsubscribe anytime.', 'wconvert')], 'cta_label' => __('Join the preview', 'wconvert'), 'fine_print' => [['text' => __('Early access opens November 26. No purchase required.', 'wconvert')], ['text' => __('You can close this window and continue browsing.', 'wconvert')]], 'success_headline' => __('Request received', 'wconvert'), 'success_body' => ['text' => __('Thanks for requesting the Black Friday preview.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
