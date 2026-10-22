<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-acid-markdown',
    'name' => __('Acid markdown', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-acid-markdown',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('BLACK FRIDAY / BIG ENERGY', 'wconvert'), __('OFF SELECTED FAVOURITES', 'wconvert')],
        'headline' => [__('SMALL PRICES.
BIG PLANS.', 'wconvert'), __('40%', 'wconvert')],
        'body' => __('Your wishlist. Now within reach.', 'wconvert'),
        'cta_label' => __('Go big. Spend less.', 'wconvert'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
