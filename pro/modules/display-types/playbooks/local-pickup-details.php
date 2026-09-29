<?php

defined('ABSPATH') || exit;

return [
    'id' => 'local-pickup-details',
    'name' => __('Explain collection from a local shop', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['stores'],
    'notes' => __('Set the actual pickup-information URL. Check address, opening hours, collection process and exceptions; do not imply that a request reserves stock.', 'wconvert'),
    'copy' => ['badge'=>__('Pickup', 'wconvert'), 'headline'=>__('Collect from our shop.', 'wconvert'), 'cta_label'=>__('See pickup details', 'wconvert')],
    'rules' => [['type'=>'time_on_page', 'seconds'=>20]],
    'destination_hint' => ['types'=>[], 'fields'=>[]],
];
