<?php

namespace WConvert\Template;

defined('ABSPATH') || exit;

/** The bounded linear flow, shared by publication, packs and capture. */
final class CaptureJourney
{
    public const ACTIONS = ['next', 'back', 'submit', 'skip', 'close', 'link'];
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
        $names = [];
        foreach ($steps as $index => $step) {
            if (!is_array($step) || !self::identifier($step['id'] ?? null) || isset($screens[$step['id']])
                || !in_array($step['kind'] ?? null, ['content', 'input', 'acknowledgement'], true)
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
                if ($type === 'button') {
                    if ($node['hidden'] ?? false) { continue; }
                    $action = $node['action'] ?? '';
                    if (!in_array($action, self::ACTIONS, true)) { return 'actions'; }
                    if (($index === 0 && $action === 'back') || ($index === count($steps) - 1 && in_array($action, ['next', 'submit', 'skip'], true))) { return 'actions'; }
                    $buttons[] = [$node, $index];
                }
                if ($type === 'followup' && !($node['hidden'] ?? false)
                    && ($step['kind'] !== 'acknowledgement' || trim((string) ($node['label'] ?? '')) === '' || trim((string) ($node['href'] ?? '')) === '')) { return 'followup'; }
            }
        }
        if ($submissions === []) {
            return count($steps) === 1 && $steps[0]['kind'] === 'content'
                && count(array_filter($buttons, static fn (array $entry): bool => $entry[0]['action'] === 'link')) === 1
                && count(array_filter($buttons, static fn (array $entry): bool => in_array($entry[0]['action'], ['submit', 'next', 'skip'], true))) === 0 ? null : 'flow';
        }
        if ($steps[count($steps) - 1]['kind'] !== 'acknowledgement'
            || count(array_filter($steps, static fn (array $step): bool => $step['kind'] === 'acknowledgement')) !== 1) { return 'screens'; }
        $owned = [];
        $seen = [];
        $previous = -1;
        foreach ($submissions as $index => $submission) {
            if (!is_array($submission) || !self::identifier($submission['id'] ?? null)
                || isset($seen[$submission['id']]) || ($submission['required'] ?? null) !== ($index === 0)) { return 'submissions'; }
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
                if ($index > 0 && !in_array('skip', $actions, true)) { return 'navigation'; }
            }
            $previous = $end;
        }
        foreach ($nodes as $id => $node) {
            if (in_array($node['type'] ?? '', ['field', 'consent'], true) && !isset($owned[$id])) { return 'references'; }
        }
        foreach ($buttons as [$button, $at]) {
            if ($button['action'] === 'link') { return 'actions'; }
            if (in_array($button['action'], ['submit', 'skip'], true) && !isset($seen[$button['submission'] ?? ''])) { return 'references'; }
            if ($button['action'] === 'skip' && (($button['submission'] ?? '') !== ($submissions[1]['id'] ?? null)
                || $at <= self::submitScreen($tree, $submissions[0]['id']))) { return 'navigation'; }
        }
        return $previous === count($steps) - 2 ? null : 'navigation';
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
