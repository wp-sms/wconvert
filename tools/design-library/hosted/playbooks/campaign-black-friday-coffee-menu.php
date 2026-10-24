<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-black-friday-coffee-menu',
    'name' => __('Black Friday Coffee Menu', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-black-friday-coffee-menu',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert'),
    'copy' => ['eyebrow' => [__('BLACK FRIDAY / COFFEE AND KITCHEN SALE', 'wconvert'), __('COFFEE ESSENTIALS', 'wconvert')], 'headline' => __('GOOD
MORNINGS.', 'wconvert'), 'body' => [['text' => __('%b', 'wconvert'), 'emphasis' => __('30% OFF', 'wconvert')], ['text' => __('Your daily ritual.
At a once-a-year price.', 'wconvert')]], 'cta_label' => __('Shop the morning menu', 'wconvert'), 'fine_print' => ['text' => __('November 27–30. Selected items. Exclusions apply.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
