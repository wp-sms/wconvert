<?php

namespace WConvert\Goal;

use WConvert\Template\ConvertingAct;
use WConvert\Template\TemplateTree;

defined('ABSPATH') || exit;

/** What a Goal requires at publication and what its reported result proves. */
final class OutcomeContract
{
    /** @param list<string> $captureAnyOf */
    public function __construct(
        public readonly string $action,
        public readonly array $captureAnyOf,
        public readonly string $requirement,
        public readonly string $measurement,
        public readonly string $proofLevel,
        public readonly ?string $destinationType = null,
        public readonly bool $linkRequired = false,
        public readonly ?string $audienceChannel = null,
    ) {
    }

    /** Show a message: nothing converts, so Impressions are the whole report (ADR 0163). */
    public function countsNothing(): bool
    {
        return $this->action === 'none';
    }

    /** A draft can be saved while this is incomplete. The published version cannot.
     * @param array<string, mixed> $config
     */
    public function designIssue(array $config): ?string
    {
        $tree = $config['template']['tree'] ?? [];
        // `none` is no ConvertingAct: one content screen offering no act at all (ADR 0163).
        if ($this->countsNothing()) {
            $steps = is_array($tree) && is_array($tree['steps'] ?? null) ? $tree['steps'] : [];
            return count($steps) === 1 && ($steps[0]['kind'] ?? null) === 'content' && empty($tree['submissions'])
                && ConvertingAct::offeredIn($tree) === [] ? null : $this->requirement;
        }
        if (!is_array($tree) || ConvertingAct::offeredIn($tree) !== [ConvertingAct::from($this->action)]) {
            return $this->requirement;
        }
        if ($this->captureAnyOf === []) {
            return !$this->linkRequired || self::hasLink($tree['steps'][0] ?? []) ? null : $this->requirement;
        }

        // Only the visible submitting screen collects data. A phone in the
        // acknowledgement or below a hidden container cannot satisfy a Goal.
        $first = ['type' => 'stack', 'children' => []];
        $refs = $tree['submissions'][0]['fields'] ?? [];
        foreach ($tree['steps'] ?? [] as $screen) {
            foreach (\WConvert\Template\CaptureJourney::nodes($screen['content'] ?? []) as $node) {
                if (in_array($node['id'] ?? null, $refs, true)) { $first['children'][] = $node; }
            }
        }
        $fields = [];
        $walk = static function (array $node) use (&$walk, &$fields): void {
            if (($node['hidden'] ?? false) === true) return;
            if (($node['type'] ?? null) === 'field' && is_string($node['name'] ?? null)) {
                $fields[$node['name']] = ($fields[$node['name']] ?? false) || ($node['required'] ?? false) === true;
            }
            foreach (TemplateTree::childrenOf($node) as $child) {
                if (is_array($child)) $walk($child);
            }
        };
        $walk($first);
        foreach ($this->captureAnyOf as $field) {
            // CaptureForm already requires at least one identifier. A Goal
            // naming a particular channel must require that channel itself.
            if (array_key_exists($field, $fields) && (count($this->captureAnyOf) > 1 || $fields[$field])) return null;
        }
        return $this->requirement;
    }

    /**
     * The tree with what this outcome cannot carry taken out: a message counts
     * nothing, so a design's counted link buttons go, and so does a layout
     * they leave empty. Any other outcome keeps the tree as it is.
     *
     * @param array<string, mixed> $tree
     * @return array<string, mixed>
     */
    public function fitted(array $tree): array
    {
        if (!$this->countsNothing() || !is_array($tree['steps'] ?? null)) return $tree;
        $tree['steps'] = array_map(static function ($step) {
            if (is_array($step) && is_array($step['content'] ?? null)) $step['content'] = self::withoutLinks($step['content']) ?? $step['content'];
            return $step;
        }, $tree['steps']);
        return $tree;
    }

    /**
     * @param array<string, mixed> $node
     * @return array<string, mixed>|null Null where nothing is left of it.
     */
    private static function withoutLinks(array $node): ?array
    {
        if (($node['type'] ?? null) === 'button' && ($node['action'] ?? null) === 'link') return null;
        $held = false;
        foreach (TemplateTree::CHILD_KEYS as $key) {
            if (!is_array($node[$key] ?? null)) continue;
            $held = $held || $node[$key] !== [];
            $node[$key] = array_values(array_filter(array_map(
                static fn ($child) => is_array($child) ? self::withoutLinks($child) : $child,
                $node[$key]
            ), static fn ($child): bool => $child !== null));
        }
        $empty = true;
        foreach (TemplateTree::CHILD_KEYS as $key) if (($node[$key] ?? []) !== []) $empty = false;
        return $held && $empty ? null : $node;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'action' => $this->action,
            'capture_any_of' => $this->captureAnyOf,
            'requirement' => $this->requirement,
            'measurement' => $this->measurement,
            'proof_level' => $this->proofLevel,
            'destination_type' => $this->destinationType,
            'link_required' => $this->linkRequired,
            'audience_channel' => $this->audienceChannel,
        ];
    }

    /** @param list<string> $readyTypes Destination types with their required settings completed.
     * @param 'local'|'connected' $captureMode {@see \WConvert\Destination\OptinBinding::captureMode()}.
     * @param list<string> $readyChannels Channels supported by selected audience services.
     */
    public function handoffIssue(array $readyTypes, string $captureMode, array $readyChannels = []): ?string
    {
        // Kept in WConvert only, the lead is saved and that satisfies the Goal
        // (ADR 0133). A lead magnet gets a non-blocking warning in the review.
        if ($captureMode === 'local') return null;
        if ($this->audienceChannel !== null && !in_array($this->audienceChannel, $readyChannels, true)) {
            return __('Choose and set up a service for this channel, or choose “Keep in WConvert only” before publishing.', 'wconvert');
        }
        return $this->destinationType !== null && !in_array($this->destinationType, $readyTypes, true)
            ? __('Connect a lead magnet email destination and complete its file link, or choose “Keep in WConvert only”, before publishing.', 'wconvert')
            : null;
    }

    /** @param array<string, mixed> $node */
    private static function hasLink(array $node): bool
    {
        if (($node['hidden'] ?? false) === true) return false;
        if (($node['type'] ?? '') === 'products') return ($node['source'] ?? 'selected') === 'cross_sells' || !empty($node['product_ids']);
        if (($node['type'] ?? null) === 'button' && ($node['action'] ?? null) === 'link') {
            $href = trim((string) ($node['href'] ?? ''));
            return $href !== '' && $href !== '#';
        }
        foreach (TemplateTree::childrenOf($node) as $child) {
            if (is_array($child) && self::hasLink($child)) return true;
        }
        return false;
    }
}
