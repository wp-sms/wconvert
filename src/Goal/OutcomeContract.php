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
    ) {
    }

    /** A draft can be saved while this is incomplete. The published version cannot.
     * @param array<string, mixed> $config
     */
    public function designIssue(array $config): ?string
    {
        $tree = $config['template']['tree'] ?? [];
        if (!is_array($tree) || ConvertingAct::offeredIn($tree) !== [ConvertingAct::from($this->action)]) {
            return $this->requirement;
        }
        if ($this->captureAnyOf === []) {
            return !$this->linkRequired || self::hasLink($tree['steps'][0] ?? []) ? null : $this->requirement;
        }

        // Only the visible submitting screen collects data. A phone in the
        // acknowledgement or below a hidden container cannot satisfy a Goal.
        $first = $tree['steps'][0] ?? [];
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
        if (is_array($first)) $walk($first);
        foreach ($this->captureAnyOf as $field) {
            // CaptureForm already requires at least one identifier. A Goal
            // naming a particular channel must require that channel itself.
            if (array_key_exists($field, $fields) && (count($this->captureAnyOf) > 1 || $fields[$field])) return null;
        }
        return $this->requirement;
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
        ];
    }

    /** @param list<string> $readyTypes Destination types with their required settings completed. */
    public function handoffIssue(array $readyTypes): ?string
    {
        return $this->destinationType !== null && !in_array($this->destinationType, $readyTypes, true)
            ? __('Connect a lead magnet email destination and complete its file link before publishing.', 'wconvert')
            : null;
    }

    /** @param array<string, mixed> $node */
    private static function hasLink(array $node): bool
    {
        if (($node['hidden'] ?? false) === true) return false;
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
