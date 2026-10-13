<?php

namespace WConvert\Destination;

use WConvert\Lead\CaptureSource;
use WConvert\Lead\Lead;

defined('ABSPATH') || exit;

/**
 * **One accepted submission, whole** — for a [[Destination]] that forwards a
 * submission rather than mapping its fields into a vendor's.
 *
 * It is a snapshot of the journey **up to and including** the submission
 * being pushed, never past it. A two-step email→SMS signup pushes twice, and a
 * retry of the first push an hour after the second step must still describe
 * the first step: a receiver upserting by `lead_id` would otherwise be handed
 * a phone number by the push that had none (ADR 0103, ADR 0148).
 *
 * Every key is always present, null where empty, so the receiver's first
 * sample shows the same shape as every later one.
 *
 * @since 0.1.0
 */
final class PushDetails
{
    /**
     * @return array{lead_id: string, submission: string, accepted_at: string|null,
     *     contact: array{email: string|null, phone: string|null, name: string|null}, interest: string|null,
     *     answers: array<string, array{question: string, answer: string|list<string>}>,
     *     consent: array{purpose: string, email: array{text: string, accepted_at: string|null}|null, sms: array{text: string, accepted_at: string|null}|null},
     *     source: array{page_url: string, utm: array<string, string|null>}|null}
     */
    public static function of(Lead $lead, string $submissionId): array
    {
        $values = [];
        $answers = [];
        $consent = ['purpose' => 'request', 'email' => null, 'sms' => null];
        $acceptedAt = null;
        $submissions = is_array($lead->capture['submissions'] ?? null) ? $lead->capture['submissions'] : [];
        foreach ($submissions as $id => $snapshot) {
            if (!is_array($snapshot)) continue;
            $values = array_merge($values, array_filter(is_array($snapshot['values'] ?? null) ? $snapshot['values'] : [], 'is_string'));
            foreach (is_array($snapshot['question_answers'] ?? null) ? $snapshot['question_answers'] : [] as $answer) {
                if (is_array($answer) && is_string($answer['id'] ?? null)) $answers[$answer['id']] = self::answer($answer);
            }
            $purpose = is_string($snapshot['purpose'] ?? null) ? $snapshot['purpose'] : 'request';
            $at = is_string($snapshot['accepted_at'] ?? null) ? $snapshot['accepted_at'] : null;
            if ($purpose === 'email_marketing' || $purpose === 'sms_marketing') {
                $consent[$purpose === 'email_marketing' ? 'email' : 'sms'] = ['text' => (string) ($snapshot['values']['consent_text'] ?? ''), 'accepted_at' => $at];
            }
            if ((string) $id === $submissionId) {
                $consent['purpose'] = $purpose;
                $acceptedAt = $at;
                break;
            }
        }
        if ($submissions === []) {
            // A snapshot already narrowed to one submission (Lead::submission()).
            $values = array_filter(['email' => $lead->email, 'phone' => $lead->phone, ...$lead->fields], 'is_string');
            foreach ($lead->questionAnswers as $answer) {
                if (is_string($answer['id'] ?? null)) $answers[$answer['id']] = self::answer($answer);
            }
            $consent['purpose'] = is_string($lead->capture['purpose'] ?? null) ? $lead->capture['purpose'] : 'request';
        }
        $recorded = $lead->capture['source'] ?? null;
        $source = null;
        if (is_array($recorded) && is_string($recorded['page_url'] ?? null)) {
            $utm = [];
            foreach (CaptureSource::UTM as $tag) $utm[$tag] = self::text($recorded['utm'][$tag] ?? null);
            $source = ['page_url' => $recorded['page_url'], 'utm' => $utm];
        }
        return ['lead_id' => $lead->id, 'submission' => $submissionId, 'accepted_at' => $acceptedAt,
            'contact' => ['email' => self::text($values['email'] ?? null), 'phone' => self::text($values['phone'] ?? null), 'name' => self::text($values['name'] ?? null)],
            'interest' => self::text($values['interest'] ?? null),
            'answers' => $answers, 'consent' => $consent,
            'source' => $source];
    }

    /**
     * What a test send carries: the merchant's own values, and a plausible
     * value for everything else.
     *
     * @param array<string, string> $values
     * @param array<string, array{question: string, answer: string|list<string>}>|null $answers
     * @return array<string, mixed>
     */
    public static function sample(array $values, string $purpose, ?array $answers = null): array
    {
        $now = gmdate('Y-m-d\TH:i:s\Z');
        $utm = array_fill_keys(CaptureSource::UTM, null);
        return ['lead_id' => '01TEST00000000000000SAMPLE', 'submission' => 'primary', 'accepted_at' => $now,
            'contact' => ['email' => $values['email'] ?? 'sample@example.com', 'phone' => $values['phone'] ?? '+12025550123', 'name' => $values['name'] ?? 'Sample Person'],
            'interest' => $values['interest'] ?? 'Sample interest',
            'answers' => $answers ?? ['sample_question' => ['question' => __('Sample question', 'wconvert'), 'answer' => __('Sample answer', 'wconvert')]],
            'consent' => ['purpose' => $purpose,
                'email' => ['text' => __('Sample consent wording', 'wconvert'), 'accepted_at' => $now],
                'sms' => ['text' => __('Sample consent wording', 'wconvert'), 'accepted_at' => $now]],
            'source' => ['page_url' => '/sample-page?utm_source=sample', 'utm' => ['source' => 'sample'] + $utm]];
    }

    /**
     * @param array<string, mixed> $answer
     * @return array{question: string, answer: string|list<string>}
     */
    private static function answer(array $answer): array
    {
        $type = $answer['type'] ?? '';
        $parts = $type === 'text' ? ($answer['values'] ?? []) : ($answer['labels'] ?? []);
        $parts = array_values(array_filter(is_array($parts) ? $parts : [], 'is_string'));
        return ['question' => is_string($answer['question'] ?? null) ? $answer['question'] : '',
            'answer' => $type === 'multi' ? $parts : implode('; ', $parts)];
    }

    private static function text(mixed $value): ?string
    {
        return is_string($value) && trim($value) !== '' ? $value : null;
    }
}
