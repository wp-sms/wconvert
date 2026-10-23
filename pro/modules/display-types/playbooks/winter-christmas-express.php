<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'winter-christmas-express',
    'name' => __('The Christmas express', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'winter-christmas-express',
    'notes' => __('Link to your seasonal gift edit or information page. Set a real campaign end date and time and update every displayed deadline to match. The countdown uses that end date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => __('THE CHRISTMAS EXPRESS', 'wconvert-pro'), 'fine_print' => [__('FROM OUR WORKSHOP / TO YOUR DOOR', 'wconvert-pro'), __('ORDER
BY', 'wconvert-pro'), __('DEC
2026', 'wconvert-pro'), __('CHRISTMAS ORDERS CLOSE IN', 'wconvert-pro'), __('Thoughtful gifts. Thoughtfully timed.', 'wconvert-pro')], 'headline' => __('All aboard
for Christmas.', 'wconvert-pro'), 'body' => [['text' => __('%b', 'wconvert-pro'), 'emphasis' => __('18', 'wconvert-pro')], __('Order by 18 December. Check delivery areas and dispatch dates before you buy.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('Check delivery dates', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
