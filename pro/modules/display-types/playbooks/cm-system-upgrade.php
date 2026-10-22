<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-system-upgrade',
    'name' => __('System upgrade', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'cm-system-upgrade',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('CYBER MONDAY', 'wconvert'), __('YOUR NEXT UPGRADE', 'wconvert'), __('DISCOUNT INSTALLED', 'wconvert')],
        'headline' => [__('Less spend.
More upgrade.', 'wconvert'), __('40%', 'wconvert')],
        'body' => __('Your setup called. It wants in on this.', 'wconvert'),
        'cta_label' => __('Run the upgrade', 'wconvert'),
        'fine_print' => __('Selected upgrades. No download required.', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
