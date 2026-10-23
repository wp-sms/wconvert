<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-christmas-express',
    'name' => __('The Christmas express', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-christmas-express',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert'),
    'copy' => ['eyebrow' => __('THE CHRISTMAS EXPRESS', 'wconvert'), 'fine_print' => [__('FROM OUR WORKSHOP / TO YOUR DOOR', 'wconvert'), __('ORDER
BY', 'wconvert'), __('18', 'wconvert'), __('DEC
2026', 'wconvert'), __('Thoughtful gifts. Thoughtfully timed.', 'wconvert')], 'headline' => __('All aboard
for Christmas.', 'wconvert'), 'body' => __('Order by 18 December. Check delivery areas and dispatch dates before you buy.', 'wconvert'), 'countdown_units' => ['days_label' => __('Days', 'wconvert'), 'hours_label' => __('Hrs', 'wconvert'), 'minutes_label' => __('Mins', 'wconvert'), 'seconds_label' => __('Secs', 'wconvert')], 'cta_label' => __('Check delivery dates', 'wconvert')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
