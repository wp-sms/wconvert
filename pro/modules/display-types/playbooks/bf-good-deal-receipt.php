<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'bf-good-deal-receipt',
    'name' => __('Your good-deal receipt', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bf-good-deal-receipt',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [__('THE GOOD-DEAL DEPARTMENT', 'wconvert-pro'), __('YOUR SAVING', 'wconvert-pro')],
        'headline' => [__('Black Friday
looks good on you.', 'wconvert-pro'), __('30%', 'wconvert-pro')],
        'body' => [__('Your wishlist', 'wconvert-pro'), __('100%', 'wconvert-pro'), __('A little Friday magic', 'wconvert-pro'), __('−30%', 'wconvert-pro')],
        'cta_label' => __('Make it a good Friday', 'wconvert-pro'),
        'fine_print' => __('Selected items. Keep the good feeling.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
