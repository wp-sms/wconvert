<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-black-friday-department',
    'name' => __('Black Friday Department', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-black-friday-department',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / STOREWIDE LAUNCH', 'wconvert-pro'), __('01 / WEAR IT', 'wconvert-pro'), __('02 / UPGRADE IT', 'wconvert-pro'), __('03 / RESTOCK IT', 'wconvert-pro'), __('UP TO', 'wconvert-pro'), __('OFF SELECTED
COLLECTIONS', 'wconvert-pro')], 'headline' => [__('BLACK FRIDAY.', 'wconvert-pro'), __('ALL IN.', 'wconvert-pro')], 'body' => [['text' => __('%b', 'wconvert-pro'), 'emphasis' => __('50', 'wconvert-pro')], ['text' => __('%b', 'wconvert-pro'), 'emphasis' => __('%', 'wconvert-pro')]], 'cta_label' => __('Enter the Friday sale', 'wconvert-pro'), 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
