<?php
namespace WConvert\Tests\Unit\Support;

/** Builds explicit v2 screens around the nodes a test wants to exercise. */
final class JourneyFixture
{
    /** @param array<string, mixed> $tree
     * @return array<string, mixed>
     */
    public static function tree(array $tree): array
    {
        $steps = $tree['steps'] ?? [];
        if (!is_array($steps)) { return $tree; }
        $used = [];
        $scan = static function ($value) use (&$scan, &$used): void {
            if (!is_array($value)) return;
            if (isset($value['id']) && is_string($value['id'])) $used[$value['id']] = true;
            foreach ($value as $child) $scan($child);
        };
        $scan($steps);
        $next = 1;
        $identify = static function ($node) use (&$identify, &$next, &$used) {
            if (!is_array($node)) return $node;
            $layout = in_array($node['type'] ?? '', ['stack','row','split','grid','panel','media'], true);
            if (!$layout && isset($node['type']) && !isset($node['id'])) {
                while (isset($used['n' . $next])) $next++;
                $node['id'] = 'n' . $next++; $used[$node['id']] = true;
            }
            foreach (['children','start','end'] as $key) if (is_array($node[$key] ?? null)) $node[$key] = array_map($identify, $node[$key]);
            if (($node['type'] ?? '') === 'button' && ($node['action'] ?? 'submit') === 'submit') {
                $node['action'] = 'submit'; $node['submission'] = 'primary';
            }
            return $node;
        };
        $submissions = [];
        $screens = [];
        foreach (array_values($steps) as $index => $root) {
            if (isset($root['content'])) { $screens[] = $root; continue; }
            $root = $identify($root);
            $nodes = is_array($root) ? \WConvert\Template\CaptureJourney::nodes($root) : [];
            $submits = array_filter($nodes, static fn ($n) => ($n['type'] ?? '') === 'button' && ($n['action'] ?? '') === 'submit');
            $inputs = array_filter($nodes, static fn ($n) => in_array($n['type'] ?? '', ['field','consent'], true));
            $kind = $submits || $inputs ? 'input' : ($index === count($steps) - 1 && $index > 0 ? 'acknowledgement' : 'content');
            if ($submits) $submissions[] = ['id' => 'primary', 'required' => true,
                'fields' => array_values(array_column(array_filter($nodes, static fn ($n) => ($n['type'] ?? '') === 'field'), 'id')),
                'consents' => array_values(array_column(array_filter($nodes, static fn ($n) => ($n['type'] ?? '') === 'consent'), 'id'))];
            $screens[] = ['id' => 's' . ($index + 1), 'name' => 'Screen ' . ($index + 1), 'kind' => $kind, 'content' => $root];
        }
        return ['v' => 2, ...$tree, 'steps' => $screens, 'submissions' => $tree['submissions'] ?? $submissions];
    }
}
