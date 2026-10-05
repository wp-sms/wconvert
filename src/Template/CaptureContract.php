<?php

namespace WConvert\Template;

use WConvert\Template\CaptureJourney;
use WConvert\Template\PolicyLink;
use WConvert\Template\TemplateTree;

defined('ABSPATH') || exit;

/** Published requirements and routes; never inferred from visitor input. */
final class CaptureContract
{
    /** @param array<string, mixed> $config
     * @return array<string, array{purpose: string, destination_ids: list<string>}>
     */
    public static function settings(array $config, string $goal): array
    {
        $settings = [];
        $tree = $config['template']['tree'] ?? [];
        $resultAt = array_search('result', array_column($tree['steps'] ?? [], 'kind'), true);
        foreach ($config['template']['tree']['submissions'] ?? [] as $index => $submission) {
            $id = $submission['id'];
            $purpose = $index === 0 ? match ($goal) {
                'grow_email_list' => 'email_marketing', 'grow_sms_list' => 'sms_marketing',
                'find_match' => $resultAt !== false && (is_array($tree['graph'] ?? null)
                    ? JourneyGraph::reaches($tree['graph'], $tree['steps'][$resultAt]['id'], $tree['steps'][CaptureJourney::submitScreen($tree, $id)]['id'] ?? '')
                    : $resultAt < CaptureJourney::submitScreen($tree, $id)) ? 'email_marketing' : 'request',
                default => 'request',
            } : ($goal === 'grow_sms_list' ? 'email_marketing' : 'sms_marketing');
            $entry = $config['submission_settings'][$id] ?? [];
            $routes = ($config['capture_mode'] ?? '') === 'local' ? [] : ($index === 0 ? ($config['destinations'] ?? []) : ($entry['destination_ids'] ?? []));
            $destinationIds = array_values(array_unique(array_filter(is_array($routes) ? $routes : [], 'is_string')));
            $maps = $config['integration_mappings'][$id] ?? [];
            $settings[$id] = ['purpose' => $purpose, 'destination_ids' => $destinationIds,
                'field_mappings' => array_intersect_key(is_array($maps) ? $maps : [], array_flip($destinationIds))];
        }
        return $settings;
    }

    /** @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    public static function template(array $config, string $goal, string $policyUrl): array
    {
        return PolicyLink::into(['template' => $config['template'] ?? []], $policyUrl)['template'];
    }

    /** @param array<string, mixed> $config */
    public static function issue(array $config, string $goal, string $policyUrl, bool $checkProductReferences = false): ?string
    {
        $template = self::template($config, $goal, $policyUrl);
        $tree = $template['tree'] ?? [];
        if (CommerceSupport::used($tree)) {
            if (($tree['v'] ?? null) === 3 || !CommerceSupport::active()) return 'commerce_products';
            foreach ($tree['steps'] as $screen) foreach (CaptureJourney::nodes($screen['content'] ?? []) as $node) {
                if (($node['type'] ?? '') === 'products' && (($node['context'] ?? 'cart') === 'product' || array_key_exists('main_product_id', $node)) && (!is_int($node['main_product_id'] ?? null) || $node['main_product_id'] < 1)) return 'commerce_products';
                if (($node['type'] ?? '') === 'products' && ($node['source'] ?? 'selected') !== 'cross_sells' && empty($node['product_ids'])) return 'commerce_products';
            }
        }
        if (($tree['v'] ?? null) === 3) {
            if (($issue = GraphCaptureContract::issue($tree, $goal)) !== null) { return $issue; }
        } else {
            if (($issue = CaptureJourney::issue($tree)) !== null) { return $issue; }
        }
        foreach ($tree['steps'] ?? [] as $step) {
            if (($step['kind'] ?? '') !== 'result') { continue; }
            foreach ($step['results'] ?? [] as $variant) {
                if (!in_array($variant['product_action'] ?? 'link', ['link', 'add_to_cart'], true)) return 'quiz_cart';
                if (($variant['product_action'] ?? 'link') === 'add_to_cart' && (!CommerceSupport::active() || (empty($variant['product_ids']) && !isset($variant['product_filter'])))) return 'quiz_cart';
                if (array_key_exists('product_filter', $variant) && (!ResultProductSource::valid($variant['product_filter'])
                    || ($checkProductReferences && !ResultProductSource::available($variant['product_filter'])))) return 'products';
                $hasLink = trim((string) ($variant['href'] ?? '')) !== '';
                $hasLabel = trim((string) ($variant['link_label'] ?? '')) !== '';
                if ($hasLink !== $hasLabel || ((!empty($variant['product_ids']) || isset($variant['product_filter'])) && !$hasLink)) { return 'result_link'; }
            }
            if (($step['products_required'] ?? false) === true) {
                if (!class_exists('WooCommerce') || count($step['results'] ?? []) < 2) { return 'products'; }
                foreach ($step['results'] as $variant) {
                    if (trim((string) ($variant['href'] ?? '')) === '' || trim((string) ($variant['link_label'] ?? '')) === '') { return 'products'; }
                }
                foreach (array_slice($step['results'], 0, -1) as $variant) {
                    if (empty($variant['product_ids']) && !isset($variant['product_filter'])) { return 'products'; }
                }
            }
        }
        $settings = self::settings($config, $goal);
        if (self::mappingIssue($settings, $tree)) { return 'integration_mapping'; }
        if (count($settings) > 1 && !in_array($goal, ['grow_email_list', 'grow_sms_list'], true)) { return 'purpose'; }
        foreach ($tree['submissions'] ?? [] as $submission) {
            $purpose = $settings[$submission['id']]['purpose'];
            if ($purpose === 'request') { continue; }
            $channel = $purpose === 'email_marketing' ? 'email' : 'phone';
            $identifier = false;
            $consent = false;
            foreach ($tree['steps'] as $screen) {
                foreach (CaptureJourney::nodes($screen['content']) as $node) {
                    if (in_array($node['id'] ?? null, $submission['fields'], true)
                        && ($node['name'] ?? '') === $channel && ($node['required'] ?? false)) { $identifier = true; }
                    if (in_array($node['id'] ?? null, $submission['consents'], true)
                        && !($node['hidden'] ?? false) && trim((string) ($node['text'] ?? '')) !== '') { $consent = true; }
                }
            }
            if (!$identifier || !$consent || count($submission['consents']) !== 1) { return 'consent'; }
        }
        return null;
    }

    /** A published map may name only captured sources and selected routes.
     * @param array<string, array<string, mixed>> $settings
     * @param array<string, mixed> $tree
     */
    private static function mappingIssue(array $settings, array $tree): bool
    {
        $questions = [];
        $fields = [];
        foreach ($tree['steps'] ?? [] as $index => $step) {
            foreach (CaptureJourney::nodes($step['content'] ?? []) as $node) {
                if (($node['type'] ?? '') === 'question' && is_string($node['id'] ?? null)) $questions[$node['id']] = $index;
                if (($node['type'] ?? '') === 'field' && in_array($node['name'] ?? null, ['interest', 'message'], true)) $fields['field:' . $node['name']] = $index;
            }
        }
        foreach ($settings as $submissionId => $setting) {
            $boundary = CaptureJourney::submitScreen($tree, (string) $submissionId);
            foreach ($setting['field_mappings'] ?? [] as $destinationId => $map) {
                if (!in_array($destinationId, $setting['destination_ids'], true) || !is_array($map) || count($map) > 32) return true;
                $targets = [];
                foreach ($map as $source => $target) {
                    $sourceIndex = $questions[$source] ?? $fields[$source] ?? null;
                    if ($sourceIndex === null || $sourceIndex > $boundary) return true;
                    if (!is_string($target) || preg_match('/^[A-Za-z][A-Za-z0-9_]{0,31}$/D', $target) !== 1 || isset($targets[$target])) return true;
                    $targets[$target] = true;
                }
            }
        }
        return false;
    }

    /** @param array<string, mixed> $config */
    public static function fingerprint(array $config, string $goal, string $policyUrl): string
    {
        $template = self::template($config, $goal, $policyUrl);
        // Only input requirements, words and flow affect what is accepted.
        $payload = TemplateTree::rewrittenIn(['template' => $template], static function (array $node): array {
            unset($node['tokens'], $node['narrow']);
            return $node;
        });
        return hash('sha256', (string) wp_json_encode([$payload['template']['tree'], self::settings($config, $goal)]));
    }
}
