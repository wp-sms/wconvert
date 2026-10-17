<?php

namespace WConvert\Template;

use WConvert\Rules\DisplayPlan;
use WConvert\Support\ProPresence;
use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * A campaign's config from a few plain facts: a design or a starter's config,
 * words by [[Slot Role]], one link, and the schedule, frequency and display
 * rules it should keep.
 *
 * Import (ADR 0153) and an agent's `create-campaign` (ADR 0154) both build
 * here, so a campaign described in a file and one described in a sentence
 * become the same config. What it returns is still only a draft's body: it
 * goes through `POST /optins`, which normalises and refuses as for any save.
 */
final class CampaignBuilder
{
    /** The display types a free install has designs for (PackValidator's rule). */
    public const FREE_DISPLAY_TYPES = ['popup', 'inline'];

    public function __construct(
        private readonly TemplateLibrary $library,
        private readonly TemplateVocabulary $vocabulary,
        private readonly ProPresence $pro,
    ) {
    }

    /**
     * The config this campaign becomes, or why this site refuses it.
     *
     * `$base` is a starter's prefilled config, which already holds its design
     * and words; without one the campaign names a `design` or carries a whole
     * `template`.
     *
     * @param array<string, mixed> $campaign `display_type`, `design`|`template`, `copy`, `link`, and any of `targeting`, `frequency`, `starts_at`, `ends_at`, `inline_placement`, `display_rules`.
     * @param array<string, mixed>|null $base
     * @return array<string, mixed>|string
     */
    public function build(array $campaign, ?string $occasion, ?array $base = null): array|string
    {
        $type = (string) ($campaign['display_type'] ?? $base['display_type'] ?? 'popup');
        if (!$this->displayTypeRuns($type)) {
            return __('This display type needs WConvert Pro.', 'wconvert');
        }
        $design = $campaign['design'] ?? null;
        $linked = ['display_type' => $type] + ($occasion === null ? [] : ['occasion' => $occasion]);
        if ($base !== null) {
            $config = array_replace($base, $linked);
            $config['template']['tree'] = SlotRoles::bind($config['template']['tree'] ?? [], is_array($campaign['copy'] ?? null) ? $campaign['copy'] : [], $this->vocabulary);
        } elseif (is_string($design)) {
            $entry = $this->library->find($design);
            if ($entry === null) return __('This site does not have that design.', 'wconvert');
            if (($entry['display_type'] ?? 'popup') !== $type) return __('That design is for a different display type.', 'wconvert');
            $config = $this->library->snapshotInto($linked + ['template_id' => $design]);
            $config['template']['tree'] = SlotRoles::bind($config['template']['tree'], is_array($campaign['copy'] ?? null) ? $campaign['copy'] : [], $this->vocabulary);
        } else {
            $config = $linked + ['template' => $campaign['template'] ?? null];
        }
        if (is_string($campaign['link'] ?? null) && $campaign['link'] !== '') {
            $config = self::linked($config, $campaign['link']);
            unset($config['unchecked_links']);
        }
        foreach (['targeting', 'frequency', 'starts_at', 'ends_at', 'inline_placement'] as $key) {
            if (isset($campaign[$key])) $config[$key] = $campaign[$key];
        }
        // A campaign that names no display plan shows as a fresh setup does.
        $config['display_rules'] = $campaign['display_rules'] ?? $config['display_rules'] ?? DisplayPlan::immediate();
        return $config;
    }

    /** Whether this install has designs for a display type at all. */
    public function displayTypeRuns(string $type): bool
    {
        return $this->pro->installedTier() !== Tier::Free || in_array($type, self::FREE_DISPLAY_TYPES, true);
    }

    /**
     * Every link button in the design pointed at one address.
     *
     * @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    public static function linked(array $config, string $link): array
    {
        return TemplateTree::rewrittenIn($config, static function (array $node) use ($link): array {
            if (($node['type'] ?? null) === 'button' && ($node['action'] ?? null) === 'link') $node['href'] = $link;
            return $node;
        });
    }

    /**
     * The first link button's address, or null.
     *
     * @param array<string, mixed> $config
     */
    public static function linkIn(array $config): ?string
    {
        $link = null;
        TemplateTree::rewrittenIn($config, static function (array $node) use (&$link): array {
            if ($link === null && ($node['type'] ?? null) === 'button' && ($node['action'] ?? null) === 'link' && is_string($node['href'] ?? null) && $node['href'] !== '') $link = $node['href'];
            return $node;
        });
        return $link;
    }
}
