<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-dispatch-desk',
    'name' => __('The dispatch desk', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-dispatch-desk',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date. Place the block or shortcode where this belongs.', 'wconvert-pro'),
    'copy' => ['body' => [__('18', 'wconvert-pro'), __('December
Christmas order cutoff', 'wconvert-pro'), __('Place your Christmas order before 18 December. Delivery areas and terms apply.', 'wconvert-pro')], 'eyebrow' => __('FROM THE DISPATCH DESK', 'wconvert-pro'), 'headline' => __('Plan your
Christmas delivery.', 'wconvert-pro'), 'fine_print' => [__('CHRISTMAS ORDERS CLOSE IN', 'wconvert-pro'), __('Selected items. Offer terms apply.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Check delivery options', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
