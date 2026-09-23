<?php
namespace WConvert\Tests\Unit\Support;

use WConvert\Rules\DisplayPlan;
use WConvert\Rules\RuleVocabulary;

/** Concise canonical plans for tests unrelated to authoring group structure. */
final class DisplayFixture
{
    /** @param array<string, mixed> $entry
     * @return array<string, mixed>
     */
    public static function entry(array $entry): array
    {
        $rules = [];
        foreach (['triggers', 'conditions'] as $axis) {
            foreach (is_array($entry[$axis] ?? null) ? $entry[$axis] : [] as $rule) {
                if (is_array($rule) && is_string($rule['type'] ?? null)) $rules[] = $rule;
            }
        }
        $plan = self::plan($rules);
        unset($entry['triggers'], $entry['conditions']);
        return $entry + ['display_rules' => $plan];
    }

    /** @param list<array<string, mixed>> $rules
     * @return array<string, mixed>
     */
    public static function plan(array $rules = [['type' => 'page_load']]): array
    {
        return DisplayPlan::fromCatalogue($rules, RuleVocabulary::fromManifest(__DIR__ . '/../../..'));
    }
}
