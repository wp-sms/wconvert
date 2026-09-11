<?php

/** An invitation to the merchant's existing booking service. */

defined('ABSPATH') || exit;

return [
    'id' => 'consultation-invitation',
    'name' => __('An invitation to consult', 'wconvert'),
    'goal' => 'collect_enquiries',
    'template_id' => 'photo-offer',
    'notes' => __('Target your service pages and link the button to your existing booking service. Replace the image placeholder with your team or work, and describe what your consultation covers. WConvert counts clicks to that service, not appointments or enquiries submitted there. Availability, scheduling and confirmations stay with your booking service.', 'wconvert'),
    'copy' => [
        'headline' => __('Find the next step for your project', 'wconvert'),
        'body' => __('A first conversation about what you need, what is possible and whether we can help.', 'wconvert'),
        'cta_label' => __('View consultation times', 'wconvert'),
        'fine_print' => __('Choose and confirm a time on our booking page.', 'wconvert'),
    ],
    'rules' => [
        ['type' => 'time_on_page', 'seconds' => 20],
    ],
];
