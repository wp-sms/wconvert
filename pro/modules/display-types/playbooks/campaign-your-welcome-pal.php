<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-your-welcome-pal',
    'name' => __('Your Welcome Pal', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-your-welcome-pal',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('WELCOME OFFER', 'wconvert-pro'), 'headline' => __('NEW HERE?
TAKE 15% OFF.', 'wconvert-pro'), 'body' => ['text' => __('A little welcome for your first order of selected favorites.', 'wconvert-pro')], 'cta_label' => __('Shop with 15% off', 'wconvert-pro'), 'fine_print' => ['text' => __('First order only. Selected items. Exclusions apply.', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
