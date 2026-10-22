<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-good-deal-receipt',
    'name' => __('Your good-deal receipt', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-good-deal-receipt',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('THE GOOD-DEAL DEPARTMENT', 'wconvert'), __('YOUR SAVING', 'wconvert')],
        'headline' => [__('Black Friday
looks good on you.', 'wconvert'), __('30%', 'wconvert')],
        'body' => [__('Your wishlist', 'wconvert'), __('100%', 'wconvert'), __('A little Friday magic', 'wconvert'), __('−30%', 'wconvert')],
        'cta_label' => __('Make it a good Friday', 'wconvert'),
        'fine_print' => __('Selected items. Keep the good feeling.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
