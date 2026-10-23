<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'cm-system-upgrade',
    'name' => __('System upgrade', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'cm-system-upgrade',
    'notes' => __('Present a seasonal offer without collecting details. Set the offer link and match the discount, coupon and terms to your store.', 'wconvert-pro'),
    'copy' => [
        'eyebrow' => [__('CYBER MONDAY', 'wconvert-pro'), __('YOUR NEXT UPGRADE', 'wconvert-pro'), __('DISCOUNT INSTALLED', 'wconvert-pro')],
        'headline' => [__('Less spend.
More upgrade.', 'wconvert-pro'), __('40%', 'wconvert-pro')],
        'body' => __('Your setup called. It wants in on this.', 'wconvert-pro'),
        'cta_label' => __('Run the upgrade', 'wconvert-pro'),
        'fine_print' => __('Selected upgrades. No download required.', 'wconvert-pro'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
