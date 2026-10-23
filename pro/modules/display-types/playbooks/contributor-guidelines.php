<?php

defined('ABSPATH') || exit;

return [
    'id' => 'contributor-guidelines',
    'name' => __('Show editorial submission guidelines', 'wconvert-pro'),
    'goal' => 'promote_offer',
    'template_id' => 'bar-announcement',
    'business_types' => ['publishers'],
    'notes' => __('Show on editorial and about pages. Link to real submission guidance and a working pitch route. The campaign itself collects no pitch or file.', 'wconvert-pro'),
    'copy' => ['badge' => __('Contribute', 'wconvert-pro'), 'headline' => __('An idea for our next issue?', 'wconvert-pro'), 'cta_label' => __('Read submission guidance', 'wconvert-pro')],
    'rules' => [['type' => 'page_load']],
    'destination_hint' => ['types' => [], 'fields' => []],
];
