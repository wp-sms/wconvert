<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-dispatch-desk',
    'name' => __('The dispatch desk', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-dispatch-desk',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date. Place the block or shortcode where this belongs.', 'wconvert'),
    'copy' => ['fine_print' => [__('18', 'wconvert'), __('Selected items. Offer terms apply.', 'wconvert')], 'body' => [__('December
Christmas order cutoff', 'wconvert'), __('Place your Christmas order before 18 December. Delivery areas and terms apply.', 'wconvert')], 'eyebrow' => __('FROM THE DISPATCH DESK', 'wconvert'), 'headline' => __('Plan your
Christmas delivery.', 'wconvert'), 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('Check delivery options', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
