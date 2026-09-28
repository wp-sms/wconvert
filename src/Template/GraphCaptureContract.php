<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** Publication checks for a graph journey's visible save and result boundaries. */
final class GraphCaptureContract
{
    /** @param array<string, mixed> $tree */
    public static function issue(array $tree, string $goal): ?string
    {
        if (($issue = JourneyGraph::issue($tree)) !== null) { return $issue; }
        $steps = $tree['steps'];
        $graph = $tree['graph'];
        $entry = $graph['entry'];
        $submissions = $tree['submissions'] ?? null;
        if (!is_array($submissions) || !array_is_list($submissions) || count($submissions) > 2) { return 'submissions'; }
        $screens = [];
        $nodes = [];
        $fieldNames = [];
        $resources = [];
        $submitButtons = [];
        $skipButtons = [];
        $terminal = [];
        $result = null;
        $questionCount = 0;
        $questionWeights = [];
        $questionScreens = [];
        foreach ($steps as $screen) {
            $id = $screen['id'];
            $questionWeights[$id] = 0;
            $kind = $screen['kind'] ?? null;
            if (!in_array($kind, ['content', 'input', 'result', 'acknowledgement'], true)
                || !is_string($screen['name'] ?? null) || trim($screen['name']) === ''
                || mb_strlen($screen['name']) > 120 || !is_array($screen['content'] ?? null)
                || isset($screen['paths']) || ($id === $entry && isset($screen['when']))
                || (in_array($kind, ['result', 'acknowledgement'], true) && isset($screen['when']))) { return 'screens'; }
            $screens[$id] = $screen;
            $outgoing = array_values(array_filter($graph['edges'], static fn (array $edge): bool => $edge['from'] === $id));
            if ($outgoing === []) $terminal[] = $id;
            if ($kind === 'result') {
                if ($result !== null) { return 'results'; }
                $result = $id;
                if (($issue = self::resultIssue($screen['results'] ?? null)) !== null) { return $issue; }
            }
            $actions = [];
            foreach (CaptureJourney::nodes($screen['content']) as $node) {
                $type = $node['type'] ?? null;
                $nodeId = $node['id'] ?? null;
                if (is_string($nodeId)) {
                    if (!CaptureJourney::identifier($nodeId) || isset($nodes[$nodeId])) { return 'references'; }
                    $nodes[$nodeId] = ['node' => $node, 'screen' => $id];
                }
                if (in_array($type, ['field', 'consent', 'question'], true) && ($kind !== 'input' || !is_string($nodeId))) { return 'screens'; }
                if ($type === 'question') {
                    $questionCount++;
                    $questionWeights[$id]++;
                    if (!isset($screen['when'])) $questionScreens[$id] = true;
                    if (($issue = self::questionIssue($node)) !== null) { return $issue; }
                }
                if ($type === 'field' && (($node['hidden'] ?? false) || !in_array($node['name'] ?? null, ['email', 'phone', 'name', 'interest'], true)
                    || ($node['name'] === 'interest' && empty($node['options'])) || isset($fieldNames[$node['name']]))) { return 'fields'; }
                if ($type === 'field') $fieldNames[$node['name']] = true;
                // A hidden, unowned checkbox can preserve optional-signup copy
                // while the same screen is a request gate. It cannot be accepted.
                if ($type === 'consent' && ($node['hidden'] ?? false)
                    && array_filter($submissions, static fn ($submission): bool => is_array($submission)
                        && in_array($nodeId, is_array($submission['consents'] ?? null) ? $submission['consents'] : [], true))) { return 'consent'; }
                if ($type === 'button' && !($node['hidden'] ?? false)) {
                    $action = $node['action'] ?? null;
                    if (!in_array($action, CaptureJourney::ACTIONS, true)) { return 'actions'; }
                    $actions[] = $action;
                    if ($action === 'submit') $submitButtons[$node['submission'] ?? ''][] = $id;
                    if ($action === 'skip') $skipButtons[$node['submission'] ?? ''][] = $id;
                    if ($action === 'link') { return 'actions'; }
                }
                if ($type === 'followup' && !($node['hidden'] ?? false)
                    && (trim((string) ($node['label'] ?? '')) === '' || trim((string) ($node['href'] ?? '')) === '')) { return 'followup'; }
                if ($type === 'followup' && !($node['hidden'] ?? false)) $resources[] = $id;
            }
            if ($outgoing !== [] && !in_array('next', $actions, true) && !in_array('submit', $actions, true)) { return 'navigation'; }
            if (in_array('submit', $actions, true) && in_array('next', $actions, true)) { return 'navigation'; }
            if ($outgoing === [] && in_array($kind, ['content', 'input'], true)) { return 'screens'; }
            if ($outgoing === [] && array_intersect($actions, ['next', 'submit', 'skip']) !== []) { return 'navigation'; }
        }
        if (self::maximumQuestions($graph, $questionWeights) > CaptureJourney::MAX_QUESTIONS) { return 'question_path_limit'; }
        if ($terminal === []) { return 'routes'; }
        if ($goal === 'find_match') {
            if ($result === null || count($submissions) > 1 || self::bypasses($graph, $entry, $result, $terminal)) { return 'capture_paths'; }
            if ($questionCount === 0 || !array_filter(array_keys($questionScreens),
                static fn (string $screenId): bool => !self::bypasses($graph, $entry, $screenId, [$result]))) { return 'questions'; }
        } elseif (!in_array($goal, ['grow_email_list', 'grow_sms_list', 'collect_enquiries', 'deliver_lead_magnet'], true)
            || $result !== null || $submissions === []) { return 'flow'; }
        if ($goal === 'collect_enquiries' && count($submissions) !== 1) { return 'submissions'; }
        $owned = [];
        $seenSubmissions = [];
        $primaryScreen = null;
        foreach ($submissions as $index => $submission) {
            if (!is_array($submission) || !CaptureJourney::identifier($submission['id'] ?? null)
                || isset($seenSubmissions[$submission['id']]) || !is_bool($submission['required'] ?? null)
                || !is_array($submission['fields'] ?? null) || !array_is_list($submission['fields'])
                || !is_array($submission['consents'] ?? null) || !array_is_list($submission['consents'])) { return 'submissions'; }
            $submissionId = $submission['id'];
            $seenSubmissions[$submissionId] = true;
            if (count($submitButtons[$submissionId] ?? []) !== 1) { return 'submissions'; }
            $submitScreen = $submitButtons[$submissionId][0];
            if ($screens[$submitScreen]['kind'] !== 'input' || isset($screens[$submitScreen]['when'])) { return 'submissions'; }
            if ($index === 0) $primaryScreen = $submitScreen;
            if ($index > 0 && ($primaryScreen === null || $primaryScreen === $submitScreen || !$submissions[0]['required']
                || self::bypasses($graph, $entry, $primaryScreen, [$submitScreen]))) { return 'capture_paths'; }
            if ($index === 0 && $goal !== 'find_match' && !$submission['required']) { return 'submissions'; }
            if (count($skipButtons[$submissionId] ?? []) !== ($submission['required'] ? 0 : 1)
                || (!$submission['required'] && $skipButtons[$submissionId][0] !== $submitScreen)) { return 'navigation'; }
            $identifier = false;
            foreach (['fields' => 'field', 'consents' => 'consent'] as $key => $type) {
                foreach ($submission[$key] as $ref) {
                    $source = is_string($ref) ? ($nodes[$ref] ?? null) : null;
                    if ($source === null || isset($owned[$ref]) || ($source['node']['type'] ?? null) !== $type
                        || isset($screens[$source['screen']]['when'])
                        || self::bypasses($graph, $entry, $source['screen'], [$submitScreen])) { return 'references'; }
                    $owned[$ref] = true;
                    if ($type === 'field' && in_array($source['node']['name'] ?? null, ['email', 'phone'], true)
                        && ($source['node']['required'] ?? false)) $identifier = true;
                }
            }
            if (!$identifier) { return 'identifier'; }
            if (count($submission['consents']) > 1) { return 'consent'; }
            if ($submission['required'] && self::bypasses($graph, $entry, $submitScreen, $goal === 'find_match' ? [$result] : $terminal)) {
                return 'capture_paths';
            }
            if ($goal === 'find_match' && $submission['required'] && !JourneyGraph::reaches($graph, $submitScreen, $result)) { return 'capture_paths'; }
        }
        foreach ($nodes as $id => $source) {
            if (in_array($source['node']['type'] ?? null, ['field', 'consent'], true)
                && !($source['node']['hidden'] ?? false) && !isset($owned[$id])) { return 'references'; }
            if ($goal !== 'find_match' && ($source['node']['type'] ?? null) === 'question'
                && $source['screen'] !== $primaryScreen
                && JourneyGraph::reaches($graph, $primaryScreen, $source['screen'])) { return 'capture_paths'; }
        }
        foreach ($resources as $screenId) {
            if ($primaryScreen === null || self::bypasses($graph, $entry, $primaryScreen, [$screenId])) { return 'followup'; }
        }
        if (array_diff(array_keys($submitButtons), array_keys($seenSubmissions)) !== []
            || array_diff(array_keys($skipButtons), array_keys($seenSubmissions)) !== []) { return 'references'; }
        return null;
    }

    /** True when some route reaches a target without showing the required screen.
     * @param array<string, mixed> $graph
     * @param list<string> $targets
     */
    private static function bypasses(array $graph, string $entry, string $required, array $targets): bool
    {
        if ($entry === $required) { return false; }
        $pending = [$entry];
        $seen = [];
        while ($pending !== []) {
            $id = array_pop($pending);
            if ($id === $required || isset($seen[$id])) { continue; }
            if (in_array($id, $targets, true)) { return true; }
            $seen[$id] = true;
            foreach ($graph['edges'] as $edge) if ($edge['from'] === $id) $pending[] = $edge['to'];
        }
        return false;
    }

    /** Longest question-bearing route in an already validated acyclic graph.
     * Answer rules can narrow this bound, never increase it. Hidden exits skip
     * their source questions. Exclusive branches must not share one total cap.
     * @param array<string, mixed> $graph
     * @param array<string, int> $weights
     */
    private static function maximumQuestions(array $graph, array $weights): int
    {
        $outgoing = [];
        foreach ($graph['edges'] as $edge) $outgoing[$edge['from']][] = $edge;
        $memo = [];
        $visit = static function (string $id) use (&$visit, &$memo, $weights, $outgoing): int {
            if (isset($memo[$id])) return $memo[$id];
            $best = $weights[$id];
            foreach ($outgoing[$id] ?? [] as $edge) {
                $own = $edge['kind'] === 'hidden' ? 0 : $weights[$id];
                $best = max($best, $own + $visit($edge['to']));
            }
            return $memo[$id] = $best;
        };
        return $visit($graph['entry']);
    }

    /** @param array<string, mixed> $node */
    private static function questionIssue(array $node): ?string
    {
        if (!in_array($node['answer_type'] ?? null, ['single', 'multi', 'text'], true)
            || ($node['hidden'] ?? false)
            || !is_string($node['label'] ?? null) || trim($node['label']) === '' || mb_strlen($node['label']) > 200
            || !is_bool($node['required'] ?? false)) { return 'questions'; }
        $choices = $node['options'] ?? [];
        if (($node['answer_type'] === 'text' && $choices !== [])
            || ($node['answer_type'] !== 'text' && (!is_array($choices) || !array_is_list($choices)
                || count($choices) < 2 || count($choices) > 12))) { return 'questions'; }
        if ($node['answer_type'] !== 'text') {
            $seen = [];
            foreach ($choices as $choice) {
                if (!is_array($choice) || !is_string($choice['value'] ?? null) || trim($choice['value']) === ''
                    || isset($seen[$choice['value']]) || !is_string($choice['label'] ?? null) || trim($choice['label']) === '') { return 'questions'; }
                $seen[$choice['value']] = true;
            }
        }
        return null;
    }

    /** @param mixed $variants */
    private static function resultIssue($variants): ?string
    {
        if (!is_array($variants) || !array_is_list($variants) || count($variants) < 1 || count($variants) > 6) { return 'results'; }
        $seen = [];
        foreach ($variants as $index => $variant) {
            if (!is_array($variant) || !CaptureJourney::identifier($variant['id'] ?? null) || isset($seen[$variant['id']])
                || !is_string($variant['heading'] ?? null) || trim($variant['heading']) === ''
                || !is_string($variant['body'] ?? null) || !is_array($variant['product_ids'] ?? null)
                || count($variant['product_ids']) > 6
                || ($index === count($variants) - 1) === isset($variant['when'])) { return 'results'; }
            $seen[$variant['id']] = true;
        }
        return null;
    }
}
