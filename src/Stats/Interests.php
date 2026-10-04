<?php
namespace WConvert\Stats;

defined('ABSPATH') || exit;

/** Retained submitted interest choices; never a source for historical conversion totals. */
final class Interests
{
    /** @param list<array<string, string|null>> $rows
     * @return array{answered: int, choices: list<array{label: string, count: int}>, questions: list<array{question: string, answered: int, choices: list<array{label: string, count: int}>}>} */
    public static function summarize(array $rows): array
    {
        $choices = [];
        $answered = 0;
        $questions = [];
        foreach ($rows as $row) {
            $data = json_decode($row['fields'] ?? '{}', true);
            foreach ($data['question_answers'] ?? [] as $answer) {
                if (!is_array($answer) || !in_array($answer['type'] ?? '', ['single', 'multi'], true)
                    || !is_string($answer['id'] ?? null) || !is_string($answer['question'] ?? null)
                    || !is_array($answer['values'] ?? null) || !is_array($answer['labels'] ?? null) || $answer['labels'] === []) continue;
                $question = hash('sha256', $answer['id'] . "\0" . $answer['question'] . "\0" . $answer['type']);
                $questions[$question] ??= ['question' => $answer['question'], 'answered' => 0, 'choices' => []];
                $questions[$question]['answered']++;
                foreach ($answer['labels'] as $i => $label) {
                    $value = $answer['values'][$i] ?? null;
                    if (!is_string($label) || !is_string($value)) continue;
                    $key = hash('sha256', $value . "\0" . $label);
                    $questions[$question]['choices'][$key] ??= ['label' => $label, 'count' => 0];
                    $questions[$question]['choices'][$key]['count']++;
                }
            }
            $value = $data['answers']['interest'] ?? null;
            $label = $data['answers']['interest_label'] ?? null;
            if (!is_string($value) || $value === '' || !is_string($label) || $label === '') continue;
            $key = hash('sha256', $value . "\0" . $label);
            $choices[$key] ??= ['label' => $label, 'count' => 0];
            $choices[$key]['count']++;
            $answered++;
        }
        usort($choices, static fn (array $a, array $b): int => $b['count'] <=> $a['count']);
        foreach ($questions as &$question) {
            usort($question['choices'], static fn (array $a, array $b): int => $b['count'] <=> $a['count']);
        }
        unset($question);
        return ['answered' => $answered, 'choices' => $choices, 'questions' => array_values($questions)];
    }
}
