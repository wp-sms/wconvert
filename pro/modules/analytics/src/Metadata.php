<?php
namespace WConvert\Pro\Module\Analytics;

use WConvert\Optin\AnalyticsPreference;

defined('ABSPATH') || exit;

final class Metadata
{
    /** @param list<array<string, mixed>> $entries
     * @param list<array<string, mixed>> $set
     * @return array<string, array<string, string>> */
    public static function forEntries(array $entries, array $set): array
    {
        $indexed = array_column($set, null, 'id');
        $result = [];
        foreach ($entries as $entry) {
            $id = (string) ($entry['id'] ?? '');
            if ($id === '' || !isset($indexed[$id])) continue;
            $family = (string) ($indexed[$id]['analytics_campaign'] ?? $entry['campaign'] ?? $id);
            $owner = $indexed[$id] ?? [];
            try { $preference = AnalyticsPreference::normalize($owner['analytics'] ?? null); }
            catch (\InvalidArgumentException) { continue; }
            if ($preference['off']) continue;
            $steps = $entry['template']['tree']['steps'] ?? [];
            $quiz = array_filter($steps, static fn (array $step): bool => ($step['kind'] ?? '') === 'result') !== [];
            $result[$id] = ['campaign' => $family, 'goal' => (string) ($indexed[$id]['goal'] ?? ''),
                'display' => (string) ($entry['display_type'] ?? 'popup'),
                'outcome' => self::outcome($entry['template']['tree'] ?? [], $quiz),
                'label' => $preference['label'] ?: 'Campaign ' . substr($family, -8)];
        }
        return $result;
    }

    /** A message offers no act and sends no conversion event (ADR 0163).
     * @param array<string, mixed> $tree */
    private static function outcome(array $tree, bool $quiz): string
    {
        $acts = \WConvert\Template\ConvertingAct::offeredIn($tree);
        if ($acts === []) return 'none';
        if (in_array(\WConvert\Template\ConvertingAct::AddToCart, $acts, true)) return 'addition';
        return $quiz ? 'quiz' : (empty($tree['submissions']) ? 'click' : 'capture');
    }
}
