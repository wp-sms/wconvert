<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-an-evening-worth-making',
    'name' => __('An evening worth making', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-an-evening-worth-making',
    'notes' => __('Set the action link and review the offer wording. Set a real campaign end date and match every written deadline. The countdown uses that saved date. Place the campaign using its block or shortcode.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('The neighbourhood table', 'wconvert-pro'), __('At the table', 'wconvert-pro'), __('Booking closes in', 'wconvert-pro')], 'headline' => __('Good food.
Better company.', 'wconvert-pro'), 'body' => [['text' => __('Join us for our seasonal supper. Explore the menu, dates and booking details.', 'wconvert-pro')], ['text' => __('Seasonal plates', 'wconvert-pro')], ['text' => __('A shared main', 'wconvert-pro')], ['text' => __('Something sweet', 'wconvert-pro')]], 'cta_label' => __('See the supper menu', 'wconvert-pro'), 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'fine_print' => ['text' => __('Reserve and pay on the booking page.', 'wconvert-pro')]],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
