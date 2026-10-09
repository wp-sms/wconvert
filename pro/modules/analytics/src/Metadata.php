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
                'outcome' => in_array(\WConvert\Template\ConvertingAct::AddToCart, \WConvert\Template\ConvertingAct::offeredIn($entry['template']['tree'] ?? []), true) ? 'addition' : ($quiz ? 'quiz' : (empty($entry['template']['tree']['submissions']) ? 'click' : 'capture')),
                'label' => $preference['label'] ?: 'Campaign ' . substr($family, -8)];
        }
        return $result;
    }
}
