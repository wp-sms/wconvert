<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-black-friday-departments',
    'name' => __('Black Friday Departments', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-black-friday-departments',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / STOREWIDE SELECTED COLLECTIONS', 'wconvert-pro'), __('01 / FOOTWEAR', 'wconvert-pro'), __('02 / EVERYDAY TECH', 'wconvert-pro'), __('03 / AUDIO', 'wconvert-pro')], 'headline' => __('YOUR FRIDAY FINDS.
UP TO 50% OFF.', 'wconvert-pro'), 'cta_label' => __('Shop all departments', 'wconvert-pro'), 'body' => ['text' => __('Footwear, everyday tech and audio. One Black Friday event.', 'wconvert-pro')], 'fine_print' => ['text' => __('November 27–30. Selected collections. Exclusions apply.', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
