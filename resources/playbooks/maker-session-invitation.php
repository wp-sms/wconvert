<?php

defined('ABSPATH') || exit;

return [
    'id' => 'maker-session-invitation',
    'name' => __('Introduce maker-session news before signup', 'wconvert'),
    'goal' => 'grow_email_list',
    'template_id' => 'journey-offer-first',
    'business_types' => ['stores'],
    'notes' => __('Use on maker-story pages after meaningful reading. Continue only reveals the form; it saves nothing. Announcements do not reserve a place.', 'wconvert'),
    'copy' => ['screens' => ['screen:offer' => ['headline' => __('Curious about how it is made?', 'wconvert'), 'body' => __('Request occasional news of maker demonstrations, with the format and booking details when announced.', 'wconvert'), 'next_label' => __('Show me the signup', 'wconvert'), 'close_label' => __('Maybe later', 'wconvert')], 'submission:email' => ['headline' => __('Hear about maker sessions.', 'wconvert'), 'email_label' => __('Email address', 'wconvert'), 'email_placeholder' => __('you@example.com', 'wconvert'), 'consent_text' => __('Email me maker-session announcements. I can unsubscribe anytime.', 'wconvert'), 'cta_label' => __('Request maker-session news', 'wconvert')], 'acknowledgement' => ['success_headline' => __('Request received', 'wconvert'), 'success_body' => __('Thank you. We have received your request for maker-session announcements.', 'wconvert')]]],
    'rules' => [['type' => 'time_on_page', 'seconds' => 20]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
