<?php

defined('ABSPATH') || exit;

return [
    'id' => 'workspace-change-story',
    'name' => __('See how a workspace changed', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'project-pair',
    'business_types' => ['services'],
    'notes' => __('Embed beside relevant portfolio content and add a working case-study URL. The diagrams are an illustrated layout study, not evidence of completed client work. Replace media and captions together with licensed project evidence, or keep them as an illustration. Do not promise safety, access suitability or performance outcomes from the drawings.', 'wconvert'),
    'copy' => [
        'eyebrow' => [__('An illustrated layout study', 'wconvert'), __('Before', 'wconvert'), __('After', 'wconvert'), __('What changed', 'wconvert')],
        'headline' => __('A clearer route through the room.', 'wconvert'),
        'body' => [__('One workspace. Two ways to arrange it.', 'wconvert'), __('A central desk and scattered storage divide the room.', 'wconvert'), __('A desk by the window and storage together along one wall.', 'wconvert'), __('Move the desk. Group the storage. Leave a clearer route through the room.', 'wconvert')],
        'cta_label' => __('Read the layout story', 'wconvert'),
        'fine_print' => __('Illustrated diagrams. Every room is different, so the right layout depends on yours.', 'wconvert'),
    ],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
