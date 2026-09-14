<?php

namespace WConvert\Template\Catalog;

use RuntimeException;
use WConvert\Template\DesignBudget;
use WConvert\Template\ConvertingAct;
use WConvert\Template\TemplateLibrary;
use WConvert\Template\TemplateForm;
use WConvert\Template\TemplateManifest;
use WConvert\Template\TemplateSource;
use WConvert\Template\TemplateTree;
use WConvert\Template\TemplateVocabulary;

defined('ABSPATH') || exit;

/** The remote-data boundary. Reject unknown structure before normalization. */
final class PackValidator
{
    public const MAX_BYTES = 262144;
    public const MAX_TEMPLATES = 12;
    public const CAPABILITIES = ['template-tree:1', 'success-actions:1', 'enquiry-choice:1', 'campaign-starts:1'];

    /** @param array<string, mixed> $manifest */
    public function __construct(private readonly array $manifest, private readonly TemplateVocabulary $vocabulary)
    {
    }

    public static function shipping(): self
    {
        return new self(TemplateManifest::load(), TemplateVocabulary::fromManifest());
    }

    /** @return array<string, mixed> */
    public function decode(string $json): array
    {
        self::check(strlen($json) <= self::MAX_BYTES, __('This pack is too large.', 'wconvert'));
        $pack = json_decode($json, true, 48);
        self::check(is_array($pack), __('This pack is not valid JSON.', 'wconvert'));
        $this->keys($pack, ['schema', 'id', 'version', 'name', 'description', 'requires', 'assets', 'templates', 'playbooks']);
        self::check(($pack['schema'] ?? null) === 1, __('Update required: this pack uses a newer format.', 'wconvert'));
        self::check(self::identifier($pack['id'] ?? null) && self::version($pack['version'] ?? null), __('This pack has an invalid identity.', 'wconvert'));
        $this->words($pack['name'] ?? null, 120);
        $this->words($pack['description'] ?? null, 1000);
        $requires = $pack['requires'] ?? null;
        self::check(is_array($requires), __('This pack does not declare compatibility.', 'wconvert'));
        $this->keys($requires, ['plugin', 'tree', 'capabilities']);
        self::check(self::version($requires['plugin'] ?? null) && version_compare(WCONVERT_VERSION, $requires['plugin'], '>='), __('Update required: install a newer WConvert version for this pack.', 'wconvert'));
        self::check(($requires['tree'] ?? null) === TemplateTree::VERSION, __('Update required: this pack uses a newer design vocabulary.', 'wconvert'));
        $capabilities = $requires['capabilities'] ?? null;
        self::check(is_array($capabilities) && array_is_list($capabilities) && count($capabilities) <= 20, __('This pack has invalid requirements.', 'wconvert'));
        foreach ($capabilities as $capability) {
            self::check(is_string($capability) && in_array($capability, self::CAPABILITIES, true), __('Update required: this pack needs an unsupported capability.', 'wconvert'));
        }
        // v1 deliberately accepts placeholders only. No media fetches, data URIs,
        // tracking pixels, font downloads or executable files can enter a preview.
        self::check(($pack['assets'] ?? null) === [], __('This pack requires media installation, which is not supported yet.', 'wconvert'));
        $templates = $pack['templates'] ?? null;
        self::check(is_array($templates) && array_is_list($templates) && count($templates) > 0 && count($templates) <= self::MAX_TEMPLATES, __('This pack has an invalid design list.', 'wconvert'));
        $ids = [];
        $requiredCapabilities = ['template-tree:1'];
        foreach ($templates as $position => $template) {
            self::check(is_array($template), __('This pack contains an invalid design.', 'wconvert'));
            $this->keys($template, ['id', 'name', 'display_type', 'tier', 'tree', 'tokens']);
            self::check(self::identifier($template['id'] ?? null) && !isset($ids[$template['id']]), __('This pack repeats or misnames a design.', 'wconvert'));
            $ids[$template['id']] = true;
            $this->words($template['name'] ?? null, 120);
            self::check(($template['tier'] ?? null) === 'free' && in_array($template['display_type'] ?? null, ['inline', 'popup'], true), __('This pack needs a display format or entitlement this installer does not support yet.', 'wconvert'));
            $this->bag($template['tokens'] ?? []);
            $tree = $template['tree'] ?? null;
            self::check(is_array($tree), __('This design has no tree.', 'wconvert'));
            $this->keys($tree, ['v', 'steps']);
            self::check(($tree['v'] ?? TemplateTree::VERSION) === TemplateTree::VERSION, __('Update required: this design uses a newer vocabulary.', 'wconvert'));
            self::check(is_array($tree['steps'] ?? null) && array_is_list($tree['steps']) && count($tree['steps']) >= 1 && count($tree['steps']) <= 2, __('This design has an invalid screen list.', 'wconvert'));
            $nodeIds = [];
            $count = 0;
            foreach ($tree['steps'] as $step) {
                $this->node($step, 0, $nodeIds, $count, $requiredCapabilities);
            }
            self::check(!in_array(TemplateForm::issue($template), ['identifier', 'choices'], true), __('This design needs a usable email or phone capture form.', 'wconvert'));
            $acts = ConvertingAct::offeredIn($tree);
            self::check(count($acts) === 1 && count($tree['steps']) === $acts[0]->steps(), __('This design does not provide one valid conversion flow.', 'wconvert'));
            $source = new class ($template) implements TemplateSource {
                /** @param array<string, mixed> $entry */
                public function __construct(private readonly array $entry) {}
                public function entries(): array { return [$this->entry]; }
            };
            $library = TemplateLibrary::from($this->vocabulary, $source);
            self::check(count($library->all()) === 1, __('This design does not provide one valid conversion flow.', 'wconvert'));
            $pack['templates'][$position] = array_values($library->all())[0];
            $snapshot = ['tree' => $this->vocabulary->withoutCopy($tree), 'tokens' => $template['tokens'] ?? []];
            self::check(strlen((string) gzencode((string) json_encode($snapshot))) <= DesignBudget::PER_DESIGN, __('This design exceeds the size budget.', 'wconvert'));
        }
        if (array_key_exists('playbooks', $pack)) {
            $requiredCapabilities[] = 'campaign-starts:1';
            (new PackPlaybooks($this->vocabulary))->validate($pack);
            // Copy must obey the same inert, placeholder-only import contract
            // as design content, including after Slot Role binding.
            foreach ($pack['playbooks'] as $playbook) {
                $template = array_values(array_filter($pack['templates'], static fn (array $entry): bool => $entry['id'] === $playbook['template_id']))[0];
                $tree = \WConvert\Template\SlotRoles::bind($template['tree'], $playbook['copy'], $this->vocabulary);
                $nodeIds = []; $count = 0;
                foreach ($tree['steps'] as $step) $this->node($step, 0, $nodeIds, $count, $requiredCapabilities);
            }
        }
        self::check(array_diff(array_unique($requiredCapabilities), $capabilities) === [], __('This pack does not declare every capability its designs need.', 'wconvert'));
        return $pack;
    }

    /** @param mixed $node
     * @param array<array-key, bool> $ids
     * @param list<string> $requiredCapabilities
     */
    private function node($node, int $depth, array &$ids, int &$count, array &$requiredCapabilities): void
    {
        self::check(is_array($node) && $depth <= 12 && ++$count <= 200, __('This design is too deeply nested or has too many blocks.', 'wconvert'));
        $type = $node['type'] ?? null;
        self::check(is_string($type), __('This design has an invalid block.', 'wconvert'));
        $definition = $this->manifest['layouts'][$type] ?? $this->manifest['nodes'][$type] ?? null;
        self::check(is_array($definition), __('Update required: this design uses an unknown block.', 'wconvert'));
        $children = isset($definition['children']) ? ($definition['children'] === 'panes' ? ['start', 'end'] : ['children']) : [];
        $this->keys($node, array_merge($children === [] ? ['type', 'id', 'role'] : ['type'], self::strings($definition['content'] ?? []), self::strings($definition['params'] ?? []), $children));
        if ($children === []) {
            self::check(self::identifier($node['id'] ?? null) && !isset($ids[$node['id']]), __('This design needs unique block identities.', 'wconvert'));
            $ids[$node['id']] = true;
        }
        if (isset($node['role'])) {
            self::check(is_string($node['role']) && in_array($node['role'], $definition['roles'] ?? [], true), __('Update required: this design uses an unknown content role.', 'wconvert'));
        }
        foreach ($node as $key => $value) {
            if (in_array($key, ['type', 'id', 'role'], true)) continue;
            if (in_array($key, $children, true)) {
                self::check(is_array($value) && array_is_list($value), __('This design has an invalid block list.', 'wconvert'));
                foreach ($value as $child) $this->node($child, $depth + 1, $ids, $count, $requiredCapabilities);
            } elseif (in_array($key, ['tokens', 'narrow'], true)) {
                $this->bag($value);
            } elseif ($key === 'link') {
                self::check(is_array($value), __('This design has an invalid link label.', 'wconvert'));
                $this->keys($value, ['label']);
                $this->words($value['label'] ?? null, 200);
            } elseif ($key === 'options') {
                self::check(($node['name'] ?? null) === 'interest' && is_array($value) && $value !== [] && $this->vocabulary->choiceOptions($value) === $value, __('This design has invalid choice options.', 'wconvert'));
                foreach ($value as $option) $this->words($option['label'], 200);
            } elseif (in_array($key, ['href', 'src'], true)) {
                self::check($value === '', __('Pack links and pictures must be supplied by the site owner.', 'wconvert'));
            } elseif (in_array($key, ['hidden', 'required', 'copy', 'notch'], true)) {
                self::check(is_bool($value), __('This design has an invalid switch value.', 'wconvert'));
            } elseif (isset($definition['choices'][$key])) {
                self::check(is_string($value) || is_int($value) || is_float($value), __('This design has an invalid setting.', 'wconvert'));
                self::check(in_array((string) $value, $definition['choices'][$key], true), __('Update required: this design uses an unknown setting.', 'wconvert'));
            } elseif ($key === 'action') {
                self::check(in_array($value, ['submit', 'link'], true), __('This design has an invalid action.', 'wconvert'));
            } elseif ($type === 'field' && $key === 'name') {
                self::check(in_array($value, $this->vocabulary->fields(), true), __('Update required: this design uses an unknown field.', 'wconvert'));
            } else {
                $this->words($value, 2000);
            }
        }
        if ($type === 'followup' || ($type === 'code' && ($node['copy'] ?? false) === true)) $requiredCapabilities[] = 'success-actions:1';
        if ($type === 'field' && ($node['name'] ?? null) === 'interest') $requiredCapabilities[] = 'enquiry-choice:1';
        if ($type === 'field') {
            self::check(isset($node['name']) && is_string($node['label'] ?? null) && trim($node['label']) !== '', __('This design has an unlabelled field.', 'wconvert'));
        }
        if ($type === 'button') self::check(isset($node['action']), __('This design has no button action.', 'wconvert'));
        if ($type === 'consent') self::check(($node['hidden'] ?? null) === true, __('Pack consent must start hidden.', 'wconvert'));
    }

    /** @param mixed $bag */
    private function bag($bag): void
    {
        self::check(is_array($bag), __('This design has invalid styles.', 'wconvert'));
        foreach ($bag as $name => $value) {
            self::check(isset($this->manifest['tokens'][$name]), __('Update required: this design uses an unknown style.', 'wconvert'));
            self::check(is_string($value) && strlen($value) <= 500 && preg_match('/^[a-zA-Z0-9 #.,()%+\-*\/\'"\s]*$/D', $value) === 1, __('This pack contains unsupported style content.', 'wconvert'));
            preg_match_all('/([a-zA-Z-]+)\s*\(/', $value, $matches);
            foreach ($matches[1] as $function) {
                self::check(in_array(strtolower($function), ['calc', 'clamp', 'min', 'max', 'rgb', 'rgba', 'hsl', 'hsla', 'linear-gradient', 'radial-gradient', 'repeating-linear-gradient'], true), __('This pack contains unsupported style functions or media.', 'wconvert'));
            }
        }
    }

    /** @param mixed $value */
    public static function words($value, int $max): void
    {
        self::check(is_string($value) && strlen($value) <= $max && !preg_match('/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/', $value), __('This pack contains invalid text.', 'wconvert'));
    }

    /** @param array<mixed> $data
     * @param list<string> $allowed
     */
    public static function keys(array $data, array $allowed): void
    {
        self::check(array_diff(array_keys($data), $allowed) === [], __('Update required: this pack contains unsupported properties.', 'wconvert'));
    }

    /** @param mixed $values
     * @return list<string>
     */
    private static function strings($values): array
    {
        return is_array($values) ? array_values(array_filter($values, 'is_string')) : [];
    }

    /** @param mixed $value */
    public static function identifier($value): bool
    {
        return is_string($value) && preg_match('/^[a-z0-9][a-z0-9-]{0,59}$/D', $value) === 1;
    }

    /** @param mixed $value */
    public static function version($value): bool
    {
        return is_string($value) && preg_match('/^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/D', $value) === 1;
    }

    public static function check(bool $valid, string $message): void
    {
        if (!$valid) throw new RuntimeException($message);
    }
}
