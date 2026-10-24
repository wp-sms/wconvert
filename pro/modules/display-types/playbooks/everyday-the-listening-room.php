<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['publishers'],
    'id' => 'everyday-the-listening-room',
    'name' => __('The listening room', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-the-listening-room',
    'notes' => __('Set the action link and review the offer wording. Set a real campaign end date and match every written deadline. The countdown uses that saved date.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Independent sounds / selected with care', 'wconvert-pro'), __('The listening room', 'wconvert-pro'), __('Bookings close in', 'wconvert-pro')], 'headline' => __('Find your
next repeat.', 'wconvert-pro'), 'body' => ['text' => __('Our record-store listening evening is back. Explore the programme and book through our events page.', 'wconvert-pro')], 'countdown_units' => ['days_label' => __('Days', 'wconvert-pro'), 'hours_label' => __('Hrs', 'wconvert-pro'), 'minutes_label' => __('Mins', 'wconvert-pro'), 'seconds_label' => __('Secs', 'wconvert-pro')], 'cta_label' => __('See the listening programme', 'wconvert-pro'), 'fine_print' => ['text' => __('Booking is completed on the events page.', 'wconvert-pro')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
