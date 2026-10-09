<?php

defined('ABSPATH') || exit;

return [
    'id' => 'returns-deadline-notice',
    'name' => __('Read the current returns policy', 'wconvert'),
    'goal' => 'promote_offer',
    'template_id' => 'inline-signpost',
    'business_types' => ['stores'],
    'notes' => __('Link directly to your current returns policy from relevant seasonal collection or product pages. Exclude the policy page, basket and checkout. Confirm eligibility, exceptions and any seasonal dates on the destination page; this setup creates no deadline or extended return period. Review placement beside sticky navigation and keep dismissal available.', 'wconvert'),
    'copy' => [
        'eyebrow' => __('Seasonal shopping', 'wconvert'),
        'headline' => __('Check returns before you buy.', 'wconvert'),
        'cta_label' => __('Read returns policy', 'wconvert'),
    ],
    'rules' => [['type' => 'time_on_page', 'seconds' => 8]],
    'destination_hint' => ['types' => [], 'fields' => []],
];
