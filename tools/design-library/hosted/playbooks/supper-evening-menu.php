<?php

defined('ABSPATH') || exit;

return [
    'id' => 'supper-evening-menu',
    'name' => __('Explore a supper evening', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'supper-menu',
    'business_types' => ['services'],
    'notes' => __('Replace the sample menu and add the real event page. State actual price, availability, allergens and dietary arrangements there. This link does not reserve a table.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('THE LONG TABLE / SAMPLE MENU', 'wconvert'),
            __('01', 'wconvert'),
            __('02', 'wconvert'),
            __('03', 'wconvert'),
        ],
        'headline' => [
            __('Make an evening
of it.', 'wconvert'),
            __('To begin', 'wconvert'),
            __('At the table', 'wconvert'),
            __('Something sweet', 'wconvert'),
        ],
        'body' => [
            __('A seasonal supper, served in three chapters.', 'wconvert'),
            __('Roasted roots · cultured cream · toasted seeds', 'wconvert'),
            __('Seasonal greens · butter beans · warm flatbread', 'wconvert'),
            __('Poached pear · oat crumble · vanilla', 'wconvert'),
        ],
        'cta_label' => __('Explore the supper evenings', 'wconvert'),
        'fine_print' => __('See current dates, price and dietary information before booking.', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
