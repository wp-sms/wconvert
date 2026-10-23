<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-chrome-hour',
    'name' => __('Chrome hour', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'cm-chrome-hour',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [__('CYBER MONDAY', 'wconvert-pro'), __('OFF SELECTED FINDS', 'wconvert-pro')],
        'headline' => [__('Your next
bright idea.', 'wconvert-pro'), __('35%', 'wconvert-pro')],
        'body' => __('A digital-only drop. A very real saving.', 'wconvert-pro'),
        'cta_label' => __('Enter the chrome era', 'wconvert-pro'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
