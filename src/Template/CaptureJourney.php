<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** The bounded forward flow, shared by publication, packs and capture. */
final class CaptureJourney
{
    public const ACTIONS = ['next', 'back', 'submit', 'skip', 'close', 'link'];
    public const MAX_QUESTIONS = 10;
    /** @param array<string, mixed> $tree */
    public static function requiresPremium(array $tree): bool
    {
        if (isset($tree['graph'])) { return true; }
        foreach ($tree['steps'] ?? [] as $step) {
            if (isset($step['when']) || isset($step['paths']) || ($step['kind'] ?? '') === 'result') { return true; }
            foreach (self::nodes($step['content'] ?? []) as $node) {
                if (($node['type'] ?? '') === 'question') { return true; }
            }
        }
        return false;
    }
    /** @param array<string, mixed> $tree */
    public static function issue(array $tree): ?string
    {
        $steps = $tree['steps'] ?? [];
        $submissions = $tree['submissions'] ?? [];
        if (($tree['v'] ?? null) !== 2 || !is_array($steps) || !array_is_list($steps)
            || !is_array($submissions) || !array_is_list($submissions) || count($steps) < 1
            || count($steps) > 7 || count($submissions) > 2) {
            return 'flow';
        }
        $screens = [];
        $nodes = [];
        $positions = [];
        $buttons = [];
        $resources = [];
        $names = [];
        foreach ($steps as $index => $step) {
            if (!is_array($step) || !self::identifier($step['id'] ?? null) || isset($screens[$step['id']])
                || !in_array($step['kind'] ?? null, ['content', 'input', 'result', 'acknowledgement'], true)
                || !is_array($step['content'] ?? null) || !is_string($step['name'] ?? null)
                || trim($step['name']) === '' || mb_strlen($step['name']) > 120) {
                return 'screens';
            }
            $screens[$step['id']] = true;
            foreach (self::nodes($step['content']) as $node) {
                $type = $node['type'] ?? '';
                $id = $node['id'] ?? null;
                if (in_array($type, ['field', 'consent'], true) && !self::identifier($id)) { return 'references'; }
                if (is_string($id)) {
                    if (isset($nodes[$id])) { return 'references'; }
                    $nodes[$id] = $node;
                    $positions[$id] = $index;
                }
                if (in_array($type, ['field', 'consent'], true) && $step['kind'] !== 'input') { return 'screens'; }
                if ($type === 'field') {
                    $name = $node['name'] ?? '';
                    if (!is_string($name) || $name === '' || isset($names[$name]) || ($node['hidden'] ?? false)) { return 'fields'; }
                    $names[$name] = true;
                }
                if ($type === 'products') {
                    if (count($steps) !== 1 || $step['kind'] !== 'content' || $submissions !== [] || isset($tree['graph'])) return 'products';
                    $buttons[] = [['action' => 'link'], $index];
                }
                if ($type === 'button') {
                    if ($node['hidden'] ?? false) { continue; }
                    $action = $node['action'] ?? '';
                    if (!in_array($action, self::ACTIONS, true)) { return 'actions'; }
                    if (($index === 0 && $action === 'back') || ($index === count($steps) - 1 && in_array($action, ['next', 'submit', 'skip'], true))) { return 'actions'; }
                    $buttons[] = [$node, $index];
                }
                if ($type === 'followup' && !($node['hidden'] ?? false)) {
                    if (trim((string) ($node['label'] ?? '')) === '' || trim((string) ($node['href'] ?? '')) === '') { return 'followup'; }
                    $resources[] = $index;
                }
            }
        }
        if (($issue = self::questionIssue($steps)) !== null) { return $issue; }
        if (($issue = self::routeIssue($steps)) !== null) { return $issue; }
        $resultAt = array_search('result', array_column($steps, 'kind'), true);
        if ($submissions === []) {
            if ($resources !== []) { return 'followup'; }
            if ($resultAt !== false) {
                if ($resultAt !== count($steps) - 1) { return 'screens'; }
                for ($at = 0; $at < $resultAt; $at++) {
                    $actions = array_column(array_map(static fn (array $entry): array => $entry[0], array_filter($buttons, static fn (array $entry): bool => $entry[1] === $at)), 'action');
                    if (!in_array('next', $actions, true)) { return 'navigation'; }
                }
                return null;
            }
            return count($steps) === 1 && $steps[0]['kind'] === 'content'
                && count(array_filter($buttons, static fn (array $entry): bool => $entry[0]['action'] === 'link')) === 1
                && count(array_filter($buttons, static fn (array $entry): bool => in_array($entry[0]['action'], ['submit', 'next', 'skip'], true))) === 0 ? null : 'flow';
        }
        $terminal = $steps[count($steps) - 1]['kind'];
        if (!in_array($terminal, ['acknowledgement', 'result'], true)
            || ($terminal === 'acknowledgement' && count(array_filter($steps, static fn (array $step): bool => $step['kind'] === 'acknowledgement')) !== 1)
            || ($terminal === 'result' && count(array_filter($steps, static fn (array $step): bool => $step['kind'] === 'acknowledgement')) !== 0)) { return 'screens'; }
        $owned = [];
        $seen = [];
        $resultFirst = $resultAt !== false && $resultAt < self::submitScreen($tree, $submissions[0]['id']);
        if ($resultFirst && (count($submissions) !== 1 || $terminal !== 'acknowledgement'
            || $resultAt !== count($steps) - 3)) { return 'flow'; }
        if ($resultFirst) {
            for ($at = 0; $at <= $resultAt; $at++) {
                $actions = array_column(array_map(static fn (array $entry): array => $entry[0], array_filter($buttons, static fn (array $entry): bool => $entry[1] === $at)), 'action');
                if (!in_array('next', $actions, true)) { return 'navigation'; }
            }
        }
        $previous = $resultFirst ? $resultAt : -1;
        foreach ($submissions as $index => $submission) {
            if (!is_array($submission) || !self::identifier($submission['id'] ?? null)
                || isset($seen[$submission['id']]) || ($submission['required'] ?? null) !== ($index === 0 && !($resultAt !== false && $resultAt < self::submitScreen($tree, $submission['id'])))) { return 'submissions'; }
            $seen[$submission['id']] = true;
            $submits = array_values(array_filter($buttons, static fn (array $entry): bool => $entry[0]['action'] === 'submit' && ($entry[0]['submission'] ?? null) === $submission['id']));
            if (count($submits) !== 1 || $submits[0][1] <= $previous || $steps[$submits[0][1]]['kind'] !== 'input') { return 'submissions'; }
            $end = $submits[0][1];
            $identifier = false;
            foreach (['fields' => 'field', 'consents' => 'consent'] as $key => $type) {
                if (!is_array($submission[$key] ?? null) || !array_is_list($submission[$key])) { return 'references'; }
                foreach ($submission[$key] as $ref) {
                    if (!is_string($ref) || !isset($nodes[$ref]) || isset($owned[$ref]) || ($nodes[$ref]['type'] ?? null) !== $type
                        || $positions[$ref] <= $previous || $positions[$ref] > $end) { return 'references'; }
                    $owned[$ref] = true;
                    if ($type === 'field' && in_array($nodes[$ref]['name'] ?? '', ['email', 'phone'], true) && ($nodes[$ref]['required'] ?? false)) { $identifier = true; }
                    if ($type === 'field' && ($nodes[$ref]['name'] ?? '') === 'interest' && empty($nodes[$ref]['options'])) { return 'choices'; }
                }
            }
            if (!$identifier) { return 'identifier'; }
            if (count($submission['consents']) > 1) { return 'consent'; }
            for ($at = $previous + 1; $at <= $end; $at++) {
                $actions = array_column(array_map(static fn (array $entry): array => $entry[0], array_filter($buttons, static fn (array $entry): bool => $entry[1] === $at)), 'action');
                if ($at < $end && !in_array('next', $actions, true)) { return 'navigation'; }
                if ($at === $end && in_array('next', $actions, true)) { return 'navigation'; }
                if (!$submission['required'] && !in_array('skip', $actions, true)) { return 'navigation'; }
            }
            $previous = $end;
        }
        foreach ($nodes as $id => $node) {
            if (in_array($node['type'] ?? '', ['field', 'consent'], true) && !isset($owned[$id])) { return 'references'; }
        }
        foreach ($resources as $at) {
            if ($at <= self::submitScreen($tree, $submissions[0]['id'])) { return 'followup'; }
        }
        foreach ($buttons as [$button, $at]) {
            if ($button['action'] === 'link') { return 'actions'; }
            if (in_array($button['action'], ['submit', 'skip'], true) && !isset($seen[$button['submission'] ?? ''])) { return 'references'; }
            if ($button['action'] === 'skip' && (($button['submission'] ?? '') !== ($resultFirst ? $submissions[0]['id'] : ($submissions[1]['id'] ?? null))
                || (!$resultFirst && $at <= self::submitScreen($tree, $submissions[0]['id'])))) { return 'navigation'; }
        }
        // Offers may remain after removing an optional signup. They contain no
        // further capture and must still provide a route to acknowledgement.
        for ($at = $previous + 1; $at < count($steps) - 1; $at++) {
            $actions = array_column(array_map(static fn (array $entry): array => $entry[0], array_filter($buttons, static fn (array $entry): bool => $entry[1] === $at)), 'action');
            if ($steps[$at]['kind'] !== 'content' || !in_array('next', $actions, true)) { return 'navigation'; }
        }
        return null;
    }

    /** @param list<array<string, mixed>> $steps */
    private static function questionIssue(array $steps): ?string
    {
        $earlier = [];
        $firstBoundary = count($steps);
        $resultCount = 0;
        $questionCount = 0;
        foreach ($steps as $at => $step) {
            $kind = $step['kind'];
            $all = self::nodes($step['content']);
            $hasSubmit = count(array_filter($all, static fn (array $node): bool => ($node['type'] ?? '') === 'button' && ($node['action'] ?? '') === 'submit')) > 0;
            if ($hasSubmit || $kind === 'result') { $firstBoundary = min($firstBoundary, $at); }
            if (isset($step['when'])) {
                if ($at === 0 || $hasSubmit || in_array($kind, ['result', 'acknowledgement'], true)
                    || self::conditionIssue($step['when'], $earlier) !== null) { return 'conditions'; }
            }
            if ($kind === 'result') {
                $resultCount++;
                $variants = $step['results'] ?? null;
                if (!is_array($variants) || !array_is_list($variants) || count($variants) < 1 || count($variants) > 6) { return 'results'; }
                $seen = [];
                foreach ($variants as $i => $variant) {
                    if (!is_array($variant) || !self::identifier($variant['id'] ?? null) || isset($seen[$variant['id']])
                        || !is_string($variant['heading'] ?? null) || trim($variant['heading']) === ''
                        || !is_string($variant['body'] ?? null) || !is_array($variant['product_ids'] ?? null)
                        || count($variant['product_ids']) > 6) { return 'results'; }
                    $seen[$variant['id']] = true;
                    if ($i === count($variants) - 1) {
                        if (isset($variant['when'])) { return 'results'; }
                    } elseif (!isset($variant['when']) || self::conditionIssue($variant['when'], $earlier) !== null) { return 'conditions'; }
                }
            }
            foreach ($all as $node) {
                if (($node['type'] ?? '') !== 'question') { continue; }
                $questionCount++;
                if ($at >= $firstBoundary || !self::identifier($node['id'] ?? null)
                    || !in_array($node['answer_type'] ?? null, ['single', 'multi', 'text'], true)
                    || !is_string($node['label'] ?? null) || trim($node['label']) === '' || mb_strlen($node['label']) > 200
                    || !is_bool($node['required'] ?? false)) { return 'questions'; }
                $choices = $node['options'] ?? [];
                if (($node['answer_type'] ?? '') !== 'text' && (!is_array($choices) || count($choices) < 2 || count($choices) > 12)) { return 'questions'; }
                if (($node['answer_type'] ?? '') === 'text' && $choices !== []) { return 'questions'; }
                $earlier[$node['id']] = $node;
            }
            foreach (is_array($step['paths'] ?? null) ? $step['paths'] : [] as $route) {
                if (is_array($route) && isset($route['when']) && self::conditionIssue($route['when'], $earlier) !== null) { return 'conditions'; }
            }
        }
        if ($resultCount > 1 || $questionCount > self::MAX_QUESTIONS) { return 'flow'; }
        return null;
    }

    /** @param list<array<string, mixed>> $steps
     * Routes stay within the next capture or result boundary so a branch
     * cannot silently bypass an accepted submission or promised result. */
    private static function routeIssue(array $steps): ?string
    {
        $positions = array_flip(array_column($steps, 'id'));
        $boundaries = [];
        foreach ($steps as $index => $step) {
            if ($step['kind'] === 'result' || $step['kind'] === 'acknowledgement') { $boundaries[] = $index; }
            foreach (self::nodes($step['content']) as $node) {
                if (($node['type'] ?? '') === 'button' && ($node['action'] ?? '') === 'submit') { $boundaries[] = $index; break; }
            }
        }
        sort($boundaries);
        foreach ($steps as $index => $step) {
            if (!array_key_exists('paths', $step)) { continue; }
            $routes = $step['paths'];
            if (!is_array($routes) || !array_is_list($routes) || count($routes) < 1 || count($routes) > 6
                || $index === count($steps) - 1) { return 'routes'; }
            $seen = [];
            $limit = count($steps) - 1;
            foreach ($boundaries as $boundary) { if ($boundary > $index) { $limit = $boundary; break; } }
            foreach ($routes as $priority => $route) {
                if (!is_array($route) || !self::identifier($route['to'] ?? null)
                    || !isset($positions[$route['to']]) || isset($seen[$route['to']])
                    || $positions[$route['to']] <= $index || $positions[$route['to']] > $limit
                    || ($priority === count($routes) - 1) === isset($route['when'])) { return 'routes'; }
                $seen[$route['to']] = true;
            }
        }
        $reachable = [0 => true];
        foreach ($steps as $index => $step) {
            if (!isset($reachable[$index])) { continue; }
            $routes = $step['paths'] ?? (isset($steps[$index + 1]) ? [['to' => $steps[$index + 1]['id']]] : []);
            foreach ($routes as $route) {
                $target = $positions[$route['to']] ?? null;
                if ($target !== null) { $reachable[$target] = true; }
            }
            if (isset($step['when']) && isset($steps[$index + 1])) { $reachable[$index + 1] = true; }
        }
        if (count($reachable) !== count($steps)) { return 'routes'; }
        return null;
    }

    /** @param mixed $condition
     * @param array<string, array<string, mixed>> $earlier
     */
    private static function conditionIssue($condition, array $earlier): ?string
    {
        $normalized = JourneyRules::normalize($condition);
        if ($normalized === null) { return 'conditions'; }
        foreach ($normalized['clauses'] as $clause) {
            $question = $earlier[$clause['question']] ?? null;
            if ($question === null || $question['answer_type'] === 'text'
                || !in_array($clause['operator'], $question['answer_type'] === 'multi' ? ['includes_any', 'includes_none'] : ['is', 'is_not'], true)
                || array_diff($clause['values'], array_column($question['options'] ?? [], 'value')) !== []) { return 'conditions'; }
        }
        return null;
    }

    /** @param mixed $value */
    public static function identifier($value): bool
    {
        return is_string($value) && preg_match('/^[a-z][a-z0-9_-]{0,47}$/D', $value) === 1;
    }

    /** @param array<string, mixed> $node
     * @return list<array<string, mixed>>
     */
    public static function nodes(array $node): array
    {
        $nodes = [$node];
        foreach (TemplateTree::childrenOf($node) as $child) {
            if (is_array($child)) {
                if ($node['hidden'] ?? false) { $child['hidden'] = true; }
                array_push($nodes, ...self::nodes($child));
            }
        }
        return $nodes;
    }

    /** @param array<string, mixed> $tree */
    public static function submitScreen(array $tree, string $submission): int
    {
        foreach ($tree['steps'] ?? [] as $index => $step) {
            foreach (self::nodes($step['content'] ?? []) as $node) {
                if (($node['type'] ?? '') === 'button' && ($node['action'] ?? '') === 'submit' && ($node['submission'] ?? '') === $submission) { return $index; }
            }
        }
        return -1;
    }
}
