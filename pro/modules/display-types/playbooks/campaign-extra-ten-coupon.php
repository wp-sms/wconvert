<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'campaign-extra-ten-coupon',
    'name' => __('Extra-Ten Coupon', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'campaign-extra-ten-coupon',
    'notes' => __('Set the shop link and review the offer, eligible items and terms. Configure any coupon, spend threshold, gift or shipping offer in your shop. Match written dates to the campaign schedule.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('BLACK FRIDAY / EXTRA BLACK FRIDAY SAVING', 'wconvert-pro'), 'headline' => __('EXTRA
10% OFF', 'wconvert-pro'), 'cta_label' => __('Use my code', 'wconvert-pro'), 'fine_print' => ['text' => __('Extra 10% off selected sale styles with the code shown. Nov 27–30.', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
