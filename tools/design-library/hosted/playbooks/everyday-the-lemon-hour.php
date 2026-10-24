<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-the-lemon-hour',
    'name' => __('The lemon hour', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'everyday-the-lemon-hour',
    'notes' => __('Set the action link and review the offer wording.', 'wconvert'),
    'copy' => ['eyebrow' => __('The summer pantry', 'wconvert'), 'headline' => __('A squeeze
of something
good.', 'wconvert'), 'body' => ['text' => __('Take 15% off our picnic pantry. A brighter lunch starts here.', 'wconvert')], 'cta_label' => __('Shop the picnic edit', 'wconvert'), 'fine_print' => ['text' => __('Selected pantry items. Offer ends 30 June 2027.', 'wconvert')]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
