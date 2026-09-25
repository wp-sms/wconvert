<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** Explicit-edge traversal for version 3 journeys. No array position routes a visitor. */
final class JourneyGraph
{
    /** @param array<string, mixed> $graph */
    public static function reaches(array $graph, string $from, string $to): bool
    {
        $seen = [];
        $pending = [$from];
        while ($pending !== []) {
            $current = array_pop($pending);
            if (isset($seen[$current])) { continue; }
            $seen[$current] = true;
            foreach ($graph['edges'] ?? [] as $edge) {
                if (!is_array($edge) || ($edge['from'] ?? null) !== $current) { continue; }
                if (($edge['to'] ?? null) === $to) { return true; }
                if (is_string($edge['to'] ?? null)) { $pending[] = $edge['to']; }
            }
        }
        return false;
    }

    /** Check that explicit connections form one navigable, acyclic journey. */
    public static function issue(array $tree): ?string
    {
        $steps = $tree['steps'] ?? null;
        $graph = $tree['graph'] ?? null;
        // These are defensive parser bounds, not merchant-facing size limits.
        if (!is_array($steps) || !array_is_list($steps) || count($steps) < 1 || count($steps) > 256
            || !is_array($graph) || !CaptureJourney::identifier($graph['entry'] ?? null)
            || !is_array($graph['edges'] ?? null) || !array_is_list($graph['edges']) || count($graph['edges']) > 1024) { return 'graph'; }
        $screens = [];
        $questions = [];
        foreach ($steps as $step) {
            if (!is_array($step) || !CaptureJourney::identifier($step['id'] ?? null) || isset($screens[$step['id']])) { return 'screens'; }
            $screens[$step['id']] = $step;
            foreach (CaptureJourney::nodes($step['content'] ?? []) as $node) {
                if (($node['type'] ?? '') === 'question' && CaptureJourney::identifier($node['id'] ?? null)) {
                    if (isset($questions[$node['id']])) { return 'questions'; }
                    $questions[$node['id']] = ['screen' => $step['id'], 'node' => $node];
                }
            }
        }
        if (!isset($screens[$graph['entry']])) { return 'graph'; }
        $edges = [];
        $outgoing = [];
        foreach ($graph['edges'] as $edge) {
            if (!is_array($edge) || !CaptureJourney::identifier($edge['id'] ?? null) || isset($edges[$edge['id']])
                || !isset($screens[$edge['from'] ?? ''], $screens[$edge['to'] ?? ''])
                || !in_array($edge['kind'] ?? null, ['answer', 'default', 'hidden'], true)) { return 'routes'; }
            if (($edge['kind'] === 'answer') !== array_key_exists('when', $edge)) { return 'conditions'; }
            $edges[$edge['id']] = true;
            $outgoing[$edge['from']][] = $edge;
        }
        foreach ($screens as $id => $screen) {
            $routes = $outgoing[$id] ?? [];
            $defaults = array_values(array_filter($routes, static fn (array $edge): bool => $edge['kind'] === 'default'));
            $hidden = array_values(array_filter($routes, static fn (array $edge): bool => $edge['kind'] === 'hidden'));
            if (($routes === [] && ($screen['kind'] ?? '') === 'input')
                || count($defaults) !== ($routes === [] ? 0 : 1)
                || count($hidden) !== (isset($screen['when']) ? 1 : 0)
                || ($screen['kind'] ?? '') === 'acknowledgement' && $routes !== []) { return 'routes'; }
        }
        $visiting = [];
        $visited = [];
        $walk = static function (string $id) use (&$walk, &$visiting, &$visited, $outgoing): bool {
            if (isset($visiting[$id])) { return false; }
            if (isset($visited[$id])) { return true; }
            $visiting[$id] = true;
            foreach ($outgoing[$id] ?? [] as $edge) {
                if (!$walk($edge['to'])) { return false; }
            }
            unset($visiting[$id]);
            $visited[$id] = true;
            return true;
        };
        if (!$walk($graph['entry']) || count($visited) !== count($screens)) { return 'routes'; }
        foreach ($screens as $id => $screen) {
            if (isset($screen['when']) && self::conditionIssue($screen['when'], $id, false, $questions, $outgoing) !== null) { return 'conditions'; }
            foreach ($outgoing[$id] ?? [] as $edge) {
                if ($edge['kind'] === 'answer' && self::conditionIssue($edge['when'], $id, true, $questions, $outgoing) !== null) { return 'conditions'; }
            }
            foreach ($screen['results'] ?? [] as $variant) {
                if (isset($variant['when']) && self::conditionIssue($variant['when'], $id, false, $questions, $outgoing) !== null) { return 'conditions'; }
            }
        }
        return null;
    }

    /** A source must be on at least one incoming path; other paths may leave it unanswered. */
    private static function conditionIssue($condition, string $target, bool $allowCurrent, array $questions, array $outgoing): ?string
    {
        $condition = JourneyRules::normalize($condition);
        if ($condition === null) { return 'conditions'; }
        foreach ($condition['clauses'] as $clause) {
            $source = $questions[$clause['question']] ?? null;
            if ($source === null || ($source['node']['answer_type'] ?? '') === 'text'
                || !in_array($clause['operator'], $source['node']['answer_type'] === 'multi' ? ['includes_any', 'includes_none'] : ['is', 'is_not'], true)
                || array_diff($clause['values'], array_column($source['node']['options'] ?? [], 'value')) !== []) { return 'conditions'; }
            if ($source['screen'] === $target && $allowCurrent) { continue; }
            if ($source['screen'] === $target) { return 'conditions'; }
            $seen = [];
            $queue = [$source['screen']];
            $available = false;
            while ($queue !== []) {
                $id = array_shift($queue);
                if (isset($seen[$id])) { continue; }
                $seen[$id] = true;
                foreach ($outgoing[$id] ?? [] as $edge) {
                    if ($edge['to'] === $target) { $available = true; break 2; }
                    $queue[] = $edge['to'];
                }
            }
            if (!$available) { return 'conditions'; }
        }
        return null;
    }

    /** @param list<array<string, mixed>> $steps
     * @param array<string, mixed> $graph
     * @param array<string, string|list<string>> $answers
     * @return array{indices: list<int>, answers: array<string, string|list<string>>, decisions: list<array<string, int|string>>, hidden: list<string>}
     */
    public static function trace(array $steps, array $graph, array $answers): array
    {
        $positions = array_flip(array_column($steps, 'id'));
        $active = [];
        $indices = [];
        $decisions = [];
        $hidden = [];
        $seen = [];
        $id = $graph['entry'] ?? null;
        while (is_string($id) && isset($positions[$id]) && !isset($seen[$id])) {
            $seen[$id] = true;
            $index = $positions[$id];
            $screen = $steps[$index];
            $shown = JourneyRules::matches($screen['when'] ?? null, $active);
            if ($shown) {
                $indices[] = $index;
                foreach (CaptureJourney::nodes($screen['content'] ?? []) as $node) {
                    if (($node['type'] ?? '') === 'question' && isset($answers[$node['id'] ?? ''])) {
                        $active[$node['id']] = $answers[$node['id']];
                    }
                }
            } else {
                $hidden[] = $id;
            }
            $outgoing = array_values(array_filter($graph['edges'] ?? [], static fn ($edge): bool => is_array($edge) && ($edge['from'] ?? null) === $id));
            $choices = array_values(array_filter($outgoing, static fn (array $edge): bool => ($edge['kind'] ?? null) === 'answer'));
            $priority = null;
            $edge = null;
            if ($shown) {
                foreach ($choices as $at => $choice) {
                    if (isset($choice['when']) && JourneyRules::matches($choice['when'], $active)) { $edge = $choice; $priority = $at; break; }
                }
                if ($edge === null) {
                    foreach ($outgoing as $candidate) {
                        if (($candidate['kind'] ?? null) === 'default') { $edge = $candidate; break; }
                    }
                }
            } else {
                foreach ($outgoing as $candidate) {
                    if (($candidate['kind'] ?? null) === 'hidden') { $edge = $candidate; break; }
                }
            }
            if ($edge === null) { break; }
            $decisions[] = ['edge' => $edge['id'], 'from' => $id, 'to' => $edge['to'], 'kind' => $edge['kind']]
                + ($priority !== null ? ['priority' => $priority] : []);
            $id = $edge['to'];
        }
        return ['indices' => $indices, 'answers' => $active, 'decisions' => $decisions, 'hidden' => $hidden];
    }
}
