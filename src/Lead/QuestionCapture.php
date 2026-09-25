<?php

namespace WConvert\Lead;

use WConvert\Template\CaptureJourney;
use WConvert\Template\JourneyRules;
use WConvert\Template\JourneyGraph;

defined('ABSPATH') || exit;

/** Validates quiz answers against the published path and freezes readable labels. */
final class QuestionCapture
{
    /**
     * Questions covered by an accepted save, including optional blanks. Rebuild
     * the route from the canonical snapshots so later answers cannot move its
     * boundary or change which questions the visitor had already seen.
     *
     * @param array<string, mixed> $tree
     * @param list<array<string, mixed>> $snapshots
     * @return list<string>
     */
    public static function coveredIds(array $tree, array $snapshots, string $submissionId): array
    {
        $answers = [];
        foreach ($snapshots as $snapshot) {
            if (!is_string($snapshot['id'] ?? null) || !is_array($snapshot['values'] ?? null)) { continue; }
            $answers[$snapshot['id']] = ($snapshot['type'] ?? '') === 'multi'
                ? $snapshot['values'] : ($snapshot['values'][0] ?? '');
        }
        $steps = $tree['steps'] ?? [];
        $path = is_array($tree['graph'] ?? null)
            ? JourneyGraph::trace($steps, $tree['graph'], $answers)
            : JourneyRules::path($steps, $answers);
        $boundary = CaptureJourney::submitScreen($tree, $submissionId);
        $ids = [];
        foreach ($path['indices'] as $index) {
            foreach (CaptureJourney::nodes($steps[$index]['content'] ?? []) as $node) {
                if (($node['type'] ?? '') === 'question' && is_string($node['id'] ?? null)) { $ids[] = $node['id']; }
            }
            if ($index === $boundary) { break; }
        }
        return $ids;
    }

    /** @param array<string, mixed> $tree
     * @param mixed $posted
     * @return list<array<string, mixed>>|Refusal
     */
    public static function validate(array $tree, $posted, string $submissionId = ''): array|Refusal
    {
        if (!is_array($posted) || count($posted) > 10) {
            return new Refusal(RefusalCode::ChoiceInvalid);
        }
        $answers = [];
        $snapshots = [];
        $steps = $tree['steps'] ?? [];
        $path = is_array($tree['graph'] ?? null)
            ? JourneyGraph::trace($steps, $tree['graph'], $posted)
            : JourneyRules::path($steps, $posted);
        if ($submissionId !== '' && !in_array(CaptureJourney::submitScreen($tree, $submissionId), $path['indices'], true)) {
            return new Refusal(RefusalCode::ChoiceInvalid);
        }
        $boundary = $submissionId === '' ? -1 : CaptureJourney::submitScreen($tree, $submissionId);
        foreach ($path['indices'] as $index) {
            $step = $steps[$index];
            foreach (CaptureJourney::nodes($step['content'] ?? []) as $node) {
                if (($node['type'] ?? '') !== 'question') { continue; }
                $id = $node['id'];
                $raw = $posted[$id] ?? null;
                $type = $node['answer_type'] ?? '';
                $values = [];
                $labels = [];
                if ($type === 'text') {
                    if ($raw !== null && !is_string($raw)) { return new Refusal(RefusalCode::ChoiceInvalid, $id); }
                    $text = is_string($raw) ? trim(sanitize_textarea_field($raw)) : '';
                    if (mb_strlen($text) > 500) { return new Refusal(RefusalCode::FieldTooLong, $id); }
                    if ($text !== '') { $values = [$text]; }
                } else {
                    if ($raw !== null && !(is_string($raw) || ($type === 'multi' && is_array($raw) && array_is_list($raw)))) {
                        return new Refusal(RefusalCode::ChoiceInvalid, $id);
                    }
                    $values = $raw === null || $raw === '' ? [] : (is_array($raw) ? $raw : [$raw]);
                    if (count($values) > 12 || count(array_unique($values, SORT_REGULAR)) !== count($values)
                        || ($type === 'single' && count($values) > 1)) { return new Refusal(RefusalCode::ChoiceInvalid, $id); }
                    $options = array_column($node['options'] ?? [], 'label', 'value');
                    foreach ($values as $value) {
                        if (!is_string($value) || !array_key_exists($value, $options)) { return new Refusal(RefusalCode::ChoiceInvalid, $id); }
                        $labels[] = $options[$value];
                    }
                }
                if ($values === []) {
                    if (($node['required'] ?? false) === true) { return new Refusal(RefusalCode::FieldRequired, $id); }
                    continue;
                }
                $answers[$id] = $type === 'multi' ? $values : $values[0];
                $snapshots[] = [
                    'id' => $id,
                    'question' => $node['label'],
                    'type' => $type,
                    'values' => $values,
                    'labels' => $labels,
                    'screen' => $step['id'],
                    'submission' => $submissionId,
                ];
            }
            if ($index === $boundary) { break; }
        }
        return $snapshots;
    }
}
