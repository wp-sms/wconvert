<?php

defined('ABSPATH') || exit;

return [
    'id' => 'ceramics-open-studio',
    'name' => __('Explore the ceramics open studio', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'exhibition-wall',
    'business_types' => ['stores'],
    'notes' => __('Replace the illustrative artwork with your own work and link the real exhibition page. Add actual dates, venue, access and admission details there. The campaign does not reserve entry.', 'wconvert'),
    'copy' => [
        'eyebrow' => [
            __('FORM / AN OPEN STUDIO', 'wconvert'),
            __('MATERIAL · PROCESS · OBJECT', 'wconvert'),
            __('AN INVITATION TO LOOK CLOSER', 'wconvert'),
        ],
        'headline' => __('Objects with
a point of view.', 'wconvert'),
        'body' => __('See the finished pieces alongside sketches, tests and works in progress.', 'wconvert'),
        'cta_label' => __('Explore the open studio', 'wconvert'),
        'fine_print' => __('View the current dates, location and access details before visiting.', 'wconvert'),
    ],
    'rules' => [[ 'type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
