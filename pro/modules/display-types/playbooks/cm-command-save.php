<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-command-save',
    'name' => __('Command + save', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'cm-command-save',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert'),
    'copy' => [
        'badge' => __('⌘ S', 'wconvert'),
        'eyebrow' => __('CYBER MONDAY', 'wconvert'),
        'headline' => __('Your shortcut to 25% off.', 'wconvert'),
        'cta_label' => __('Save something good', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
