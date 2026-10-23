<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-electric-aisle',
    'name' => __('The electric aisle', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'cm-electric-aisle',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store. Place the block or shortcode where the offer belongs.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [__('CYBER MONDAY', 'wconvert-pro'), __('OFF. ALL ONLINE.', 'wconvert-pro')],
        'headline' => [__('30%', 'wconvert-pro'), __('Out of this tab.
Into your life.', 'wconvert-pro')],
        'body' => __('New favourites, one click closer.', 'wconvert-pro'),
        'cta_label' => __('Find your next favourite', 'wconvert-pro'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
