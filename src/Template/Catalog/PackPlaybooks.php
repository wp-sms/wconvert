<?php

namespace WConvert\Template\Catalog;

use WConvert\Playbook\PlaybookLibrary;
use WConvert\Rules\RuleManifest;
use WConvert\Rules\RuleVocabulary;
use WConvert\Template\SlotRoles;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateSource;
use WConvert\Template\TemplateTree;
use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

/** Strict JSON grammar before the shared Playbook registration checks. */
final class PackPlaybooks
{
    public function __construct(private readonly TemplateVocabulary $vocabulary) {}

    /** @param array<string, mixed> $pack */
    public function validate(array $pack): void
    {
        $entries = $pack['playbooks'];
        PackValidator::check(is_array($entries) && array_is_list($entries) && count($entries) > 0 && count($entries) <= 12, __('This pack has an invalid starting-point list.', 'wconvert'));
        $source = new class ($pack['templates']) implements TemplateSource {
            /** @param list<array<string, mixed>> $templates */
            public function __construct(private readonly array $templates) {}
            public function entries(): array { return $this->templates; }
        };
        $templates = TemplateLibrary::from($this->vocabulary, $source);
        $manifest = RuleManifest::load();
        $rules = RuleVocabulary::fromManifest();
        $seen = [];
        foreach ($entries as $entry) {
            PackValidator::check(is_array($entry), __('This pack contains an invalid campaign setup.', 'wconvert'));
            PackValidator::keys($entry, ['id', 'name', 'goal', 'template_id', 'copy', 'rules', 'targeting', 'destination_hint', 'notes', 'business_types']);
            PackValidator::check(PackValidator::identifier($entry['id'] ?? null) && !isset($seen[$entry['id']]), __('This pack repeats or misnames a campaign setup.', 'wconvert'));
            $seen[$entry['id']] = true;
            PackValidator::words($entry['name'] ?? null, 120);
            PackValidator::words($entry['notes'] ?? '', 2000);
            PackValidator::check(is_array($entry['copy'] ?? null), __('This campaign setup has invalid wording.', 'wconvert'));
            $this->rules($entry['rules'] ?? null, $manifest['triggers'] + $manifest['conditions']);
            $targeting = $entry['targeting'] ?? [];
            PackValidator::check(is_array($targeting), __('This campaign setup has invalid targeting.', 'wconvert'));
            PackValidator::keys($targeting, ['include', 'exclude', 'logged_in']);
            foreach (['include', 'exclude'] as $axis) {
                if (array_key_exists($axis, $targeting)) $this->rules($targeting[$axis], array_filter($manifest['targeting'], static fn (array $rule): bool => $rule['kind'] === 'page'));
            }
            if (array_key_exists('logged_in', $targeting)) PackValidator::check(is_bool($targeting['logged_in']), __('This campaign setup has invalid audience settings.', 'wconvert'));
            $hint = $entry['destination_hint'] ?? [];
            PackValidator::check(is_array($hint), __('This campaign setup has invalid destination hints.', 'wconvert'));
            PackValidator::keys($hint, ['types', 'fields']);
            foreach ($hint as $key => $values) {
                PackValidator::check(is_array($values) && array_is_list($values) && count($values) <= 12, __('This campaign setup has invalid destination hints.', 'wconvert'));
                foreach ($values as $value) {
                    PackValidator::check(is_string($value) && preg_match('/^[a-z][a-z0-9_]{0,59}$/D', $value) === 1, __('Destination hints must name types, not connections.', 'wconvert'));
                    if ($key === 'fields') PackValidator::check(in_array($value, $this->vocabulary->fields(), true), __('This campaign setup names an unknown capture field.', 'wconvert'));
                }
            }
            PackValidator::check(PlaybookLibrary::refuse($entry, $templates, $this->vocabulary, $rules) === null, __('This campaign setup refers to unsupported designs, goals, rules or site-specific content.', 'wconvert'));
            $template = $templates->find($entry['template_id']);
            $bindings = [];
            TemplateTree::rewrittenIn(['template' => $template], function (array $node) use (&$bindings): array {
                foreach (SlotRoles::bindingsOf($node, $this->vocabulary) as $role => $keys) $bindings[$role][] = $keys;
                return $node;
            });
            foreach ($entry['copy'] as $role => $words) {
                $items = is_array($words) && array_is_list($words) ? $words : [$words];
                PackValidator::check(count($items) > 0 && count($items) <= count($bindings[$role]), __('This campaign setup supplies more wording than its design can use.', 'wconvert'));
                foreach ($items as $at => $item) {
                    $keys = $bindings[$role][$at];
                    if (is_array($item)) {
                        PackValidator::check($item !== [] && !array_is_list($item), __('This campaign setup has invalid structured wording.', 'wconvert'));
                        PackValidator::keys($item, $keys);
                        foreach ($item as $key => $value) {
                            if ($key === 'link') {
                                PackValidator::check(is_array($value), __('This campaign setup has an invalid policy label.', 'wconvert'));
                                PackValidator::keys($value, ['label']);
                                PackValidator::words($value['label'] ?? null, 200);
                            } elseif ($key === 'options') {
                                PackValidator::check(is_array($value) && $value !== [] && $this->vocabulary->choiceOptions($value) === $value, __('This campaign setup has invalid choice options.', 'wconvert'));
                                foreach ($value as $option) PackValidator::words($option['label'], 200);
                            } else {
                                PackValidator::words($value, 2000);
                            }
                        }
                    } else {
                        PackValidator::check($keys !== ['options'], __('Choice wording needs named options.', 'wconvert'));
                        PackValidator::words($item, 2000);
                    }
                }
            }
        }
    }

    /** @param mixed $rules
     * @param array<string, array<string, mixed>> $definitions
     */
    private function rules($rules, array $definitions): void
    {
        PackValidator::check(is_array($rules) && array_is_list($rules) && count($rules) <= 20, __('This campaign setup has an invalid rule list.', 'wconvert'));
        foreach ($rules as $rule) {
            PackValidator::check(is_array($rule) && is_string($rule['type'] ?? null), __('This campaign setup has an invalid rule.', 'wconvert'));
            $definition = $definitions[$rule['type']] ?? null;
            PackValidator::check(is_array($definition) && $definition['tier'] === 'free', __('This campaign setup needs rules this pack format does not support.', 'wconvert'));
            $params = $definition['params'];
            $allowed = ['type'];
            foreach (array_keys($params) as $name) {
                if (!is_string($name)) throw new \RuntimeException(__('This rule declares an invalid parameter.', 'wconvert'));
                $allowed[] = $name;
            }
            PackValidator::keys($rule, $allowed);
            foreach ($params as $name => $param) {
                PackValidator::check(($param['authored'] ?? false) !== true, __('Pack rules cannot name site-specific pages or elements.', 'wconvert'));
                $value = $rule[$name] ?? null;
                $valid = match ($param['control']) {
                    'seconds' => (is_int($value) || is_float($value)) && $value >= 0 && $value <= 86400,
                    'percent' => (is_int($value) || is_float($value)) && $value >= 0 && $value <= 100,
                    'post_type' => is_string($value) && preg_match('/^[a-z][a-z0-9_-]{0,19}$/D', $value) === 1,
                    'path_glob' => is_string($value) && strlen($value) <= 200 && preg_match('~^/[a-zA-Z0-9_/*?.%=-]*$~D', $value) === 1,
                    'device_set' => is_array($value) && array_is_list($value) && $value !== [] && count($value) <= 3 && count(array_filter($value, 'is_string')) === count($value) && array_diff($value, $param['options']) === [],
                    default => false,
                };
                PackValidator::check($valid, __('This campaign setup has an invalid or unsupported rule setting.', 'wconvert'));
            }
        }
    }
}
