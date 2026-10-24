<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'everyday-the-reading-shelf',
    'name' => __('The reading shelf', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-the-reading-shelf',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording. Place the campaign using its block or shortcode.', 'wconvert'),
    'copy' => ['eyebrow' => [__('Fiction', 'wconvert'), __('Essays', 'wconvert'), __('Poetry', 'wconvert'), __('Shelf life / the monthly letter', 'wconvert'), __('Fiction', 'wconvert'), __('Essays', 'wconvert'), __('Poetry', 'wconvert'), __('Shelf life / the monthly letter', 'wconvert')], 'headline' => [__('Other
worlds.', 'wconvert'), __('Fresh
thinking.', 'wconvert'), __('Small
wonders.', 'wconvert'), __('Something
worth reading.', 'wconvert'), __('Other
worlds.', 'wconvert'), __('Fresh
thinking.', 'wconvert'), __('Small
wonders.', 'wconvert')], 'body' => ['text' => __('Our booksellers’ favourite reads, new arrivals and stories from the shop.', 'wconvert')], 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'cta_label' => __('Find my next read', 'wconvert'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert')], 'success_headline' => __('A place on the shelf.', 'wconvert'), 'success_body' => ['text' => __('Your request for Shelf life is received. Thank you for supporting independent books.', 'wconvert')], 'close_label' => __('Continue browsing', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
