<?php

namespace WConvert\Destination;

use WConvert\Lead\Lead;

defined('ABSPATH') || exit;

/**
 * **What is being pushed** — the canonical values, and whether there is a
 * [[Lead]] row behind them.
 *
 * ========================================================================
 * A TEST SEND NEVER WRITES A LEAD, AND THIS IS WHAT MAKES THAT POSSIBLE.
 * ========================================================================
 * {@see DestinationType::push()} took a `Lead`, so every push was keyed by a
 * row in `wconvert_leads`. A merchant proving their Mailchimp key works would
 * then have had to write one — and a [[Lead]] has **exactly one origin**, a
 * visitor submitting a form on a page WConvert served (ADR 0031). A test Lead
 * carries a [[Consent Record]] nobody was ever shown, which is manufactured
 * evidence rather than a shortcut.
 *
 * So the thing a Destination is handed is the VALUES, and where they came from
 * is a separate fact. A capture supplies {@see self::of()}; a merchant pressing
 * *Send a test* supplies {@see self::test()}. Both reach one `push()`.
 *
 * **`isTest` is on the subject rather than on {@see PushContext}**, because it
 * is a property of what is being sent and not of how the Destination is
 * configured. The Destination is the same Destination either way; only the
 * provenance of the payload differs.
 *
 * A type is not obliged to read it. Every v1 type pushes a test exactly as it
 * pushes a capture, which is what makes the test worth anything — a code path
 * that behaves differently under test proves the code path, not the
 * integration. It is here so a type that genuinely must say so (a subject line,
 * a vendor's own test endpoint) can, without the caller inventing a second
 * method.
 *
 * @since 0.1.0
 */
final class PushSubject
{
    /**
     * @param array<string, string> $values Canonical keys, empties already dropped.
     */
    private function __construct(
        public readonly array $values,
        public readonly bool $isTest,
        /** @var array<string, string> Provider field id => accepted text. */
        public readonly array $mapped = [],
        /** The accepted submission purpose; an email address alone is not marketing consent. */
        public readonly string $purpose = 'request',
    ) {
    }

    /** One captured [[Lead]], as the thing a Destination receives. */
    public static function of(Lead $lead, string $destinationId = ''): self
    {
        $mapping = $lead->capture['field_mappings'][$destinationId] ?? [];
        $mapped = [];
        if (is_array($mapping)) {
            foreach ($mapping as $source => $target) {
                if (!is_string($target) || !preg_match('/^[A-Za-z][A-Za-z0-9_]{0,31}$/D', $target)) continue;
                $value = null;
                if (is_string($source) && str_starts_with($source, 'field:')) {
                    $key = substr($source, 6);
                    if (in_array($key, ['interest', 'message'], true)) $value = $lead->fields[$key] ?? null;
                } else {
                    foreach ($lead->questionAnswers as $answer) {
                        if (($answer['id'] ?? null) !== $source) continue;
                        $parts = ($answer['type'] ?? '') === 'text' ? ($answer['values'] ?? []) : ($answer['labels'] ?? []);
                        $value = is_array($parts) ? implode('; ', array_filter($parts, 'is_string')) : null;
                        break;
                    }
                }
                if (is_string($value) && trim($value) !== '') $mapped[$target] = $value;
            }
        }
        return new self(CanonicalFields::of($lead), false, $mapped,
            is_string($lead->capture['purpose'] ?? null) ? $lead->capture['purpose'] : 'request');
    }

    /**
     * A merchant's own address, with no row behind it.
     *
     * The values are put through the same {@see CanonicalFields} filter a Lead
     * is, so a test cannot reach a Destination carrying a key the vocabulary
     * does not have — which is the one way a test send could otherwise exercise
     * a path a capture never takes.
     *
     * @param array<string, mixed> $values
     * @param array<string, string> $mapped
     */
    public static function test(array $values, array $mapped = [], string $purpose = 'email_marketing'): self
    {
        return new self(CanonicalFields::present($values), true, $mapped, $purpose);
    }
}
