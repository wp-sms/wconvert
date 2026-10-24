<?php

defined('ABSPATH') || exit;

return [
    'business_types' => ['stores'],
    'id' => 'everyday-almost-somewhere',
    'name' => __('Almost somewhere', 'wconvert-pro'),
    'goal' => 'grow_email_list',
    'template_id' => 'everyday-almost-somewhere',
    'notes' => __('Choose an email destination or Collect only, and review the signup wording.', 'wconvert-pro'),
    'copy' => ['eyebrow' => [__('Elsewhere / small escapes', 'wconvert-pro'), __('A postcard, once a month', 'wconvert-pro'), __('Elsewhere / small escapes', 'wconvert-pro'), __('A postcard, once a month', 'wconvert-pro')], 'headline' => __('A little further
from ordinary.', 'wconvert-pro'), 'body' => [['text' => __('Slow places. Independent stays. A few good reasons to take the long way.', 'wconvert-pro')], ['text' => __('Our favourite places, thoughtfully collected.', 'wconvert-pro')], ['text' => __('Our favourite places, thoughtfully collected.', 'wconvert-pro')]], 'email_label' => __('Email address', 'wconvert-pro'), 'email_placeholder' => __('you@example.com', 'wconvert-pro'), 'cta_label' => __('Send me somewhere', 'wconvert-pro'), 'consent_text' => ['text' => __('I agree to receive marketing emails. Unsubscribe anytime.', 'wconvert-pro')], 'success_headline' => __('Your next chapter can wait.', 'wconvert-pro'), 'success_body' => ['text' => __('Your request for Elsewhere postcards is received. Thanks for your curiosity.', 'wconvert-pro')], 'close_label' => __('Continue browsing', 'wconvert-pro')],
    'rules' => [['type' => 'time_on_page', 'seconds' => 15]],
    'destination_hint' => ['types' => [], 'fields' => ['email']],
];
