<?php

namespace WConvert\Pro\Module\Destinations;

use WConvert\Destination\PushContext;
use WConvert\Lead\CaptureSource;
use WConvert\Destination\PushSubject;

defined('ABSPATH') || exit;

/**
 * **Payload v1** — the one documented shape a webhook receives.
 *
 * Every key is always present, null where empty, because Zapier and Make learn
 * a webhook's fields from the first payload they see: a key missing from the
 * sample is a field the merchant can never map. `id` repeats the
 * `webhook-id` header because a no-code receiver cannot easily read headers
 * and still needs to dedupe.
 *
 * `timestamp` is when the submission was ACCEPTED. The `webhook-timestamp`
 * header is when this attempt was SENT, which is what lets a retry a day later
 * still pass a receiver's five-minute window.
 *
 * No IP address and no user agent: the receiver gets the lead, not the
 * visitor's device (ADR 0148).
 *
 * @since 0.1.0
 */
final class WebhookPayload
{
    /** @return array<string, mixed> */
    public static function of(PushSubject $subject, PushContext $context, string $siteUrl, string $environment): array
    {
        $details = $subject->details;
        $sample = $subject->isTest && $context->optinId === null;
        return [
            'id' => $subject->deliveryId,
            'type' => WebhookDestinationType::EVENT,
            'version' => WebhookDestinationType::VERSION,
            'timestamp' => is_string($details['accepted_at'] ?? null) ? $details['accepted_at'] : gmdate('Y-m-d\TH:i:s\Z'),
            'test' => $subject->isTest,
            'site' => ['url' => $siteUrl, 'environment' => $environment],
            'data' => [
                'lead_id' => $details['lead_id'] ?? null,
                'submission' => $details['submission'] ?? null,
                'contact' => [
                    'email' => $details['contact']['email'] ?? null,
                    'phone' => $details['contact']['phone'] ?? null,
                    'name' => $details['contact']['name'] ?? null,
                ],
                'interest' => $details['interest'] ?? null,
                // An object even when empty, so a receiver never sees `[]` one day and `{}` the next.
                'answers' => (object) ($details['answers'] ?? []),
                'campaign' => $sample
                    ? ['id' => 'sample', 'name' => __('Sample campaign', 'wconvert'), 'goal' => 'grow_email_list']
                    : ['id' => $context->optinId, 'name' => $context->optinName, 'goal' => $context->goal],
                'source' => [
                    'page_url' => $details['source']['page_url'] ?? null,
                    'utm' => array_merge(array_fill_keys(CaptureSource::UTM, null), is_array($details['source']['utm'] ?? null) ? $details['source']['utm'] : []),
                ],
                'consent' => [
                    'purpose' => $details['consent']['purpose'] ?? $subject->purpose,
                    'email' => $details['consent']['email'] ?? null,
                    'sms' => $details['consent']['sms'] ?? null,
                ],
            ],
        ];
    }
}
