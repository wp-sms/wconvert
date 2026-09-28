<?php

defined('ABSPATH') || exit;

return [
    'id' => 'showroom-information',
    'name' => __('Help shoppers plan a showroom visit', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['stores'],
    'notes' => __('Show on furniture and collection pages. Link to actual hours, access information and displayed stock. This is not a visit booking.', 'wconvert'),
    'copy' => ['badge' => __('Visit us', 'wconvert'), 'headline' => __('See the pieces in person.', 'wconvert'), 'cta_label' => __('Plan your visit', 'wconvert')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
