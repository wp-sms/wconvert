<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** Answer rules for forward journeys. Conditions only read earlier choice questions. */
final class JourneyRules
{
    /** @param mixed $condition
     * @return array{match: string, clauses: list<array{question: string, operator: string, values: list<string>}>}|null
     */
    public static function normalize($condition): ?array
    {
        if (!is_array($condition) || !in_array($condition['match'] ?? null, ['all', 'any'], true)
            || !is_array($condition['clauses'] ?? null) || !array_is_list($condition['clauses'])
            || count($condition['clauses']) < 1 || count($condition['clauses']) > 5) { return null; }
        $clauses = [];
        foreach ($condition['clauses'] as $clause) {
            if (!is_array($clause) || !CaptureJourney::identifier($clause['question'] ?? null)
                || !in_array($clause['operator'] ?? null, ['is', 'is_not', 'includes_any', 'includes_none'], true)
                || !is_array($clause['values'] ?? null) || !array_is_list($clause['values'])
                || count($clause['values']) < 1 || count($clause['values']) > 12
                || (in_array($clause['operator'], ['is', 'is_not'], true) && count($clause['values']) !== 1)) { return null; }
            foreach ($clause['values'] as $answer) {
                if (!CaptureJourney::identifier($answer)) { return null; }
            }
            if (count(array_unique($clause['values'])) !== count($clause['values'])) { return null; }
            $clauses[] = ['question' => $clause['question'], 'operator' => $clause['operator'], 'values' => $clause['values']];
        }
        return ['match' => $condition['match'], 'clauses' => $clauses];
    }

    /** @param array<string, mixed>|null $condition
     * @param array<string, string|list<string>> $answers
     */
    public static function matches(?array $condition, array $answers): bool
    {
        if ($condition === null) { return true; }
        $clauses = $condition['clauses'] ?? [];
        if (!is_array($clauses) || $clauses === []) { return false; }
        $results = [];
        foreach ($clauses as $clause) {
            $raw = $answers[$clause['question'] ?? ''] ?? null;
            if ($raw === null || $raw === '' || $raw === []) { $results[] = false; continue; }
            $actual = is_array($raw) ? $raw : [$raw];
            $hit = count(array_intersect($clause['values'] ?? [], $actual)) > 0;
            $results[] = in_array($clause['operator'] ?? '', ['is_not', 'includes_none'], true) ? !$hit : $hit;
        }
        return ($condition['match'] ?? '') === 'any' ? in_array(true, $results, true) : !in_array(false, $results, true);
    }

    /** @param list<array<string, mixed>> $steps
     * @param array<string, string|list<string>> $answers
     * @return array<string, string|list<string>>
     */
    public static function activeAnswers(array $steps, array $answers): array
    {
        return self::path($steps, $answers)['answers'];
    }

    /** @param list<array<string, mixed>> $steps
     * @param array<string, string|list<string>> $answers
     * @return array{indices: list<int>, answers: array<string, string|list<string>>}
     */
    public static function path(array $steps, array $answers): array
    {
        $active = [];
        $indices = [];
        $positions = array_flip(array_column($steps, 'id'));
        for ($at = 0; $at < count($steps);) {
            $step = $steps[$at];
            $shown = self::matches($step['when'] ?? null, $active);
            if ($shown) {
                $indices[] = $at;
                foreach (CaptureJourney::nodes($step['content'] ?? []) as $node) {
                    if (($node['type'] ?? '') === 'question' && isset($answers[$node['id'] ?? ''])) {
                        $active[$node['id']] = $answers[$node['id']];
                    }
                }
            }
            $target = $at + 1;
            foreach ($shown ? ($step['paths'] ?? []) : [] as $route) {
                if (self::matches($route['when'] ?? null, $active)) {
                    $target = $positions[$route['to'] ?? ''] ?? $target;
                    break;
                }
            }
            $at = $target > $at ? $target : $at + 1;
        }
        return ['indices' => $indices, 'answers' => $active];
    }

    /** @param list<array<string, mixed>> $variants
     * @param array<string, string|list<string>> $answers
     * @return array<string, mixed>|null
     */
    public static function result(array $variants, array $answers): ?array
    {
        foreach ($variants as $variant) {
            if (isset($variant['when']) && self::matches($variant['when'], $answers)) { return $variant; }
        }
        foreach ($variants as $variant) {
            if (!isset($variant['when'])) { return $variant; }
        }
        return null;
    }
}
