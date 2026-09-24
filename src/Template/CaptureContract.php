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
                'find_match' => $resultAt !== false && $resultAt < CaptureJourney::submitScreen($tree, $id) ? 'email_marketing' : 'request',
                default => 'request',
            } : ($goal === 'grow_sms_list' ? 'email_marketing' : 'sms_marketing');
            $entry = $config['submission_settings'][$id] ?? [];
            $routes = ($config['capture_mode'] ?? '') === 'local' ? [] : ($index === 0 ? ($config['destinations'] ?? []) : ($entry['destination_ids'] ?? []));
            $settings[$id] = ['purpose' => $purpose, 'destination_ids' => array_values(array_unique(array_filter(is_array($routes) ? $routes : [], 'is_string')))];
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
    public static function issue(array $config, string $goal, string $policyUrl): ?string
    {
        $template = self::template($config, $goal, $policyUrl);
        $tree = $template['tree'] ?? [];
        if (($issue = CaptureJourney::issue($tree)) !== null) { return $issue; }
        foreach ($tree['steps'] ?? [] as $step) {
            if (($step['kind'] ?? '') !== 'result') { continue; }
            foreach ($step['results'] ?? [] as $variant) {
                $hasLink = trim((string) ($variant['href'] ?? '')) !== '';
                $hasLabel = trim((string) ($variant['link_label'] ?? '')) !== '';
                if ($hasLink !== $hasLabel) { return 'result_link'; }
            }
            if (($step['products_required'] ?? false) === true) {
                if (!class_exists('WooCommerce') || count($step['results'] ?? []) < 2) { return 'products'; }
                foreach ($step['results'] as $variant) {
                    if (trim((string) ($variant['href'] ?? '')) === '' || trim((string) ($variant['link_label'] ?? '')) === '') { return 'products'; }
                }
                foreach (array_slice($step['results'], 0, -1) as $variant) {
                    if (empty($variant['product_ids'])) { return 'products'; }
                }
            }
        }
        $settings = self::settings($config, $goal);
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
