<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-chrome-hour',
    'name' => __('Chrome hour', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'cm-chrome-hour',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('CYBER MONDAY', 'wconvert'), __('OFF SELECTED FINDS', 'wconvert')],
        'headline' => [__('Your next
bright idea.', 'wconvert'), __('35%', 'wconvert')],
        'body' => __('A digital-only drop. A very real saving.', 'wconvert'),
        'cta_label' => __('Enter the chrome era', 'wconvert'),
        'fine_print' => __('Selected items. Offer terms apply.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
