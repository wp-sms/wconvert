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
use WConvert\Template\CaptureJourney;
use WConvert\Template\JourneySupport;
use WConvert\Support\Tier;
use WConvert\Support\WpProPresence;

defined('ABSPATH') || exit;

/** The remote-data boundary. Reject unknown structure before normalization. */
final class PackValidator
{
    public const MAX_BYTES = 262144;
    public const MAX_TEMPLATES = 12;
    public const CAPABILITIES = ['template-tree:2', 'success-actions:1', 'enquiry-choice:1', 'campaign-starts:1', 'capture-journey:1', 'question-journey:1', 'pack-images:1', 'commerce-products:1', 'result-product-filters:1', 'quiz-product-actions:1'];

    /** @param array<string, mixed> $manifest */
    public function __construct(private readonly array $manifest, private readonly TemplateVocabulary $vocabulary, private readonly Tier $installedTier = Tier::Free, private readonly bool $portable = false)
    {
    }

    public static function shipping(): self
    {
        return new self(TemplateManifest::load(), TemplateVocabulary::fromManifest(), (new WpProPresence())->installedTier());
    }

    /** Merchant files share structural validation, not catalog placeholder policy.
     * @param array<string, mixed> $design
     * @return array<string, mixed>
     */
    public function portable(array $design): array
    {
        self::check(is_array($design['tree'] ?? null) && is_array($design['tokens'] ?? null), __('This design has an invalid tree or styles.', 'wconvert'));
        $tier = CaptureJourney::requiresPremium($design['tree'] ?? []) || !in_array($design['display_type'] ?? '', ['popup', 'inline'], true) ? Tier::Basic : Tier::Free;
        if (\WConvert\Template\CommerceSupport::used($design['tree']) || \WConvert\Template\CommerceSupport::quizAdditions($design['tree'])) $tier = Tier::Elite;
        $entry = ['id' => 'imported', 'name' => $design['name'] ?? '', 'display_type' => $design['display_type'] ?? '',
            'tier' => $tier->value, 'tree' => $design['tree'] ?? [], 'tokens' => $design['tokens'] ?? []];
        $reader = new self($this->manifest, $this->vocabulary, $this->installedTier, true);
        $pack = $reader->decode(json_encode(['schema' => 1, 'id' => 'transfer', 'version' => '1.0.0', 'name' => 'Transfer', 'description' => '',
            'requires' => ['plugin' => WCONVERT_VERSION, 'tree' => TemplateTree::VERSION, 'capabilities' => self::CAPABILITIES],
            'assets' => [], 'templates' => [$entry]], JSON_THROW_ON_ERROR));
        return array_intersect_key($pack['templates'][0], array_flip(['name', 'display_type', 'tree', 'tokens']));
    }

    /** Only typed merchant action URLs are permitted, never markup or controls. */
    public static function portableUrl(mixed $value): void
    {
        self::check(is_string($value) && strlen($value) <= 2048 && !preg_match('/[<>"\\\\\x00-\x20]/', $value), __('This design contains an invalid link.', 'wconvert'));
        if (preg_match('/^([a-z][a-z0-9+.-]*):/i', $value, $match)) {
            self::check(in_array(strtolower($match[1]), ['http', 'https', 'mailto', 'tel'], true), __('This design contains an unsupported link.', 'wconvert'));
        }
        self::check(!str_starts_with($value, '//'), __('Use an explicit https address for this link.', 'wconvert'));
    }

    /** @return array<string, mixed> */
    public function decode(string $json): array
    {
        self::check(strlen($json) <= self::MAX_BYTES, __('This pack is too large.', 'wconvert'));
        $pack = json_decode($json, true, 48);
        self::check(is_array($pack), __('This pack is not valid JSON.', 'wconvert'));
        $this->keys($pack, ['schema', 'id', 'version', 'name', 'description', 'requires', 'assets', 'templates', 'playbooks', 'image_bindings']);
        self::check(in_array($pack['schema'] ?? null, [1, 2], true), __('Update required: this pack uses a newer format.', 'wconvert'));
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
        // Schema 1 accepts placeholders; schema 2 binds verified raster objects.
        // Authored URLs, font downloads and executable files stay prohibited.
        self::check(is_array($pack['assets'] ?? null), __('Invalid image manifest.', 'wconvert'));
        PackValidator::check(array_is_list($pack['assets']), __('Invalid image manifest.', 'wconvert'));
        foreach ($pack['assets'] as $asset) PackValidator::check(is_array($asset), __('Invalid image manifest.', 'wconvert'));
        VerifiedAssets::validate($pack['assets']);
        self::check($pack['schema'] === 2 || ($pack['assets'] === [] && !isset($pack['image_bindings'])), __('Images require pack schema 2.', 'wconvert'));
        $templates = $pack['templates'] ?? null;
        self::check(is_array($templates) && array_is_list($templates) && count($templates) > 0 && count($templates) <= self::MAX_TEMPLATES, __('This pack has an invalid design list.', 'wconvert'));
        $ids = [];
        $requiredCapabilities = ['template-tree:2', 'capture-journey:1'];
        foreach ($templates as $position => $template) {
            self::check(is_array($template), __('This pack contains an invalid design.', 'wconvert'));
            $this->keys($template, ['id', 'name', 'display_type', 'tier', 'tree', 'tokens']);
            self::check(self::identifier($template['id'] ?? null) && !isset($ids[$template['id']]), __('This pack repeats or misnames a design.', 'wconvert'));
            $ids[$template['id']] = true;
            $this->words($template['name'] ?? null, 120);
            $tier = Tier::tryFrom((string) ($template['tier'] ?? ''));
            self::check($tier !== null && $this->installedTier->includes($tier)
                && in_array($template['display_type'] ?? null, $tier === Tier::Free ? ['inline', 'popup'] : ['inline', 'popup', 'bar', 'slide_in', 'fullscreen'], true), __('This pack needs a display format or entitlement this installer does not support yet.', 'wconvert'));
            $this->bag($template['tokens'] ?? []);
            $tree = $template['tree'] ?? null;
            self::check(is_array($tree), __('This design has no tree.', 'wconvert'));
            if (\WConvert\Template\CommerceSupport::used($tree) || \WConvert\Template\CommerceSupport::quizAdditions($tree)) self::check($tier === Tier::Elite && \WConvert\Template\CommerceSupport::active(), __('Product suggestions require WConvert Pro and WooCommerce.', 'wconvert'));
            if (CaptureJourney::requiresPremium($tree)) {
                self::check($tier !== Tier::Free && JourneySupport::active(), __('This design uses elements this site can’t display.', 'wconvert'));
                $requiredCapabilities[] = 'question-journey:1';
            }
            $this->keys($tree, $this->portable ? ['v', 'steps', 'submissions', 'graph'] : ['v', 'steps', 'submissions']);
            self::check(($tree['v'] ?? null) === TemplateTree::VERSION || ($this->portable && ($tree['v'] ?? null) === 3), __('Update required: this design uses a newer vocabulary.', 'wconvert'));
            self::check(is_array($tree['steps'] ?? null) && array_is_list($tree['steps']) && count($tree['steps']) >= 1 && count($tree['steps']) <= ($this->portable && ($tree['v'] ?? null) === 3 ? 256 : 7), __('This design has an invalid screen list.', 'wconvert'));
            $nodeIds = [];
            $count = 0;
            foreach ($tree['steps'] as $step) {
                self::check(is_array($step), __('This design has an invalid screen.', 'wconvert'));
                $this->words($step['name'] ?? null, 120);
                $this->keys($step, ['id', 'name', 'kind', 'content', 'when', 'paths', 'results', 'products_required', 'review_answers', 'details_note']);
                if (isset($step['when'])) $this->condition($step['when']);
                if (isset($step['paths'])) {
                    self::check(is_array($step['paths']) && array_is_list($step['paths']), __('This design has invalid screen routes.', 'wconvert'));
                    foreach ($step['paths'] as $route) {
                        self::check(is_array($route), __('This design has invalid screen routes.', 'wconvert'));
                        $this->keys($route, ['to', 'when']);
                        if (isset($route['when'])) $this->condition($route['when']);
                    }
                }
                if (isset($step['review_answers'])) self::check(is_bool($step['review_answers']), __('This design has an invalid answer review setting.', 'wconvert'));
                if (isset($step['details_note'])) $this->words($step['details_note'], 500);
                if (isset($step['products_required'])) self::check(is_bool($step['products_required']), __('This design has an invalid product requirement.', 'wconvert'));
                if (isset($step['results'])) {
                    self::check(is_array($step['results']) && array_is_list($step['results']) && count($step['results']) <= 6, __('This design has invalid results.', 'wconvert'));
                    foreach ($step['results'] as $result) {
                        self::check(is_array($result), __('This design has invalid results.', 'wconvert'));
                        $this->keys($result, ['id', 'heading', 'body', 'when', 'href', 'link_label', 'product_ids', 'product_filter', 'product_action']);
                        self::check(CaptureJourney::identifier($result['id'] ?? null), __('This design has invalid results.', 'wconvert'));
                        $this->words($result['heading'] ?? null, 200);
                        $this->words($result['body'] ?? '', 500);
                        if (isset($result['link_label'])) $this->words($result['link_label'], 120);
                        if (isset($result['href']) && $this->portable) self::portableUrl($result['href']);
                        if (isset($result['href']) && !$this->portable) self::check($result['href'] === '', __('Pack links and pictures must be supplied by the site owner.', 'wconvert'));
                        self::check(($result['product_ids'] ?? []) === [], __('Choose products from this site after installing the pack.', 'wconvert'));
                        if (isset($result['product_action'])) {
                            $requiredCapabilities[] = 'quiz-product-actions:1';
                            self::check(in_array($result['product_action'], ['link', 'add_to_cart'], true), __('Choose a valid product action.', 'wconvert'));
                        }
                        if (isset($result['product_filter'])) {
                            $requiredCapabilities[] = 'result-product-filters:1';
                            self::check($result['product_filter'] === ['category_id' => 0, 'attributes' => []], __('Choose category and attribute values on this site.', 'wconvert'));
                        }
                        if (isset($result['when'])) $this->condition($result['when']);
                    }
                }
                $this->node($step['content'] ?? null, 0, $nodeIds, $count, $requiredCapabilities);
            }
            foreach (is_array($tree['submissions'] ?? null) ? $tree['submissions'] : [] as $submission) {
                self::check(is_array($submission), __('This design has an invalid submission.', 'wconvert'));
                $this->keys($submission, ['id', 'required', 'fields', 'consents']);
            }
            self::check(!in_array(TemplateForm::issue($template), ['identifier', 'choices'], true), __('This design needs a usable email or phone capture form.', 'wconvert'));
            $acts = ConvertingAct::offeredIn($tree);
            $graph = $this->portable && ($tree['v'] ?? null) === 3;
            if ($graph) {
                self::check(is_array($tree['graph'] ?? null), __('This design has no journey connections.', 'wconvert'));
                $this->keys($tree['graph'], ['entry', 'edges']);
                foreach ($tree['graph']['edges'] ?? [] as $edge) {
                    self::check(is_array($edge), __('Invalid journey connection.', 'wconvert'));
                    $this->keys($edge, ['id', 'from', 'to', 'kind', 'when']);
                    if (isset($edge['when'])) $this->condition($edge['when']);
                }
            }
            // Draft links may be unfinished, but must not short-circuit structural checks.
            $checking = $this->portable ? TemplateTree::rewrittenIn(['template' => ['tree' => $tree]], static function (array $node): array {
                if (($node['type'] ?? '') === 'followup') {
                    if (trim((string) ($node['href'] ?? '')) === '') $node['href'] = 'https://example.invalid/resource';
                    if (trim((string) ($node['label'] ?? '')) === '') $node['label'] = 'Resource';
                }
                return $node;
            })['template']['tree'] : $tree;
            $issue = $graph ? \WConvert\Template\GraphCaptureContract::issue($checking, in_array('result', array_column($tree['steps'], 'kind'), true) ? 'find_match' : 'grow_email_list') : CaptureJourney::issue($checking);
            self::check(count($acts) === 1 && $issue === null, __('This design does not provide one valid conversion flow.', 'wconvert'));
            if ($this->portable) {
                $pack['templates'][$position] = array_replace($template, $this->vocabulary->normalize($template));
            } else {
                $source = new class ($template) implements TemplateSource {
                    /** @param array<string, mixed> $entry */
                    public function __construct(private readonly array $entry) {}
                    public function entries(): array { return [$this->entry]; }
                };
                $library = TemplateLibrary::from($this->vocabulary, $source);
                self::check(count($library->all()) === 1, __('This design does not provide one valid conversion flow.', 'wconvert'));
                $pack['templates'][$position] = array_values($library->all())[0];
            }
            $snapshot = ['tree' => $this->vocabulary->withoutCopy($tree), 'tokens' => $template['tokens'] ?? []];
            self::check($this->portable || strlen((string) gzencode((string) wp_json_encode($snapshot))) <= DesignBudget::PER_DESIGN, __('This design exceeds the size budget.', 'wconvert'));
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
                foreach ($tree['steps'] as $step) $this->node($step['content'], 0, $nodeIds, $count, $requiredCapabilities);
            }
        }
        self::check(array_diff(array_unique($requiredCapabilities), $capabilities) === [], __('This pack does not declare every capability its designs need.', 'wconvert'));
        PackImages::validate($pack);
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
                $this->keys($value, $this->portable ? ['label', 'href'] : ['label']);
                if ($this->portable && isset($value['href'])) self::portableUrl($value['href']);
                $this->words($value['label'] ?? null, 200);
            } elseif ($type === 'products' && $key === 'main_product_id') {
                self::check($value === 0, __('Choose the main product from this site after installing the design.', 'wconvert'));
            } elseif ($type === 'products' && $key === 'product_ids') {
                self::check($value === [], __('Choose products from this site after installing the design.', 'wconvert'));
            } elseif ($key === 'options') {
                self::check((($node['name'] ?? null) === 'interest' || $type === 'question') && is_array($value)
                    && ($type === 'question' || $value !== []) && $this->vocabulary->choiceOptions($value) === $value, __('This design has invalid choice options.', 'wconvert'));
                foreach ($value as $option) $this->words($option['label'], 200);
            } elseif (in_array($key, ['href', 'src'], true)) {
                if ($this->portable && $key === 'href') self::portableUrl($value);
                else self::check($value === '', __('Pack links and pictures must be supplied by the site owner.', 'wconvert'));
            } elseif (in_array($key, ['hidden', 'required', 'copy', 'notch', 'exclude_cart'], true)) {
                self::check(is_bool($value) || ($this->portable && $key === 'notch' && in_array($value, ['true', 'false'], true)), __('This design has an invalid switch value.', 'wconvert'));
            } elseif (isset($definition['choices'][$key])) {
                self::check(is_string($value) || is_int($value) || is_float($value), __('This design has an invalid setting.', 'wconvert'));
                self::check(in_array((string) $value, $definition['choices'][$key], true), __('Update required: this design uses an unknown setting.', 'wconvert'));
            } elseif ($key === 'action') {
                self::check(in_array($value, CaptureJourney::ACTIONS, true), __('This design has an invalid action.', 'wconvert'));
            } elseif ($type === 'field' && $key === 'name') {
                self::check(in_array($value, $this->vocabulary->fields(), true), __('Update required: this design uses an unknown field.', 'wconvert'));
            } else {
                $this->words($value, 2000);
            }
        }
        if ($type === 'products') $requiredCapabilities[] = 'commerce-products:1';
        if ($type === 'followup' || ($type === 'code' && ($node['copy'] ?? false) === true)) $requiredCapabilities[] = 'success-actions:1';
        if ($type === 'field' && ($node['name'] ?? null) === 'interest') $requiredCapabilities[] = 'enquiry-choice:1';
        if ($type === 'field') {
            self::check(isset($node['name']) && is_string($node['label'] ?? null) && trim($node['label']) !== '', __('This design has an unlabelled field.', 'wconvert'));
        }
        if ($type === 'question') {
            self::check(CaptureJourney::identifier($node['id'] ?? null) && is_string($node['label'] ?? null)
                && trim($node['label']) !== '', __('This design has an invalid question.', 'wconvert'));
        }
        if ($type === 'button') self::check(isset($node['action']), __('This design has no button action.', 'wconvert'));
        if ($type === 'consent' && !$this->portable) self::check(($node['hidden'] ?? null) === true, __('Pack consent must start hidden.', 'wconvert'));
    }

    /** A flat, bounded condition. The journey validator checks earlier-question references. */
    private function condition(mixed $condition): void
    {
        self::check(is_array($condition), __('This design has an invalid condition.', 'wconvert'));
        $this->keys($condition, ['match', 'clauses']);
        self::check(\WConvert\Template\JourneyRules::normalize($condition) !== null, __('This design has an invalid condition.', 'wconvert'));
        foreach ($condition['clauses'] as $clause) {
            $this->keys($clause, ['question', 'operator', 'values']);
        }
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

    /** @phpstan-assert true $valid */
    public static function check(bool $valid, string $message): void
    {
        // phpcs:ignore WordPress.Security.EscapeOutput.ExceptionNotEscaped -- validation messages for an administrator, caught upstream and returned as a WP_Error that the admin renders as text; escaping here would print the entities.
        if (!$valid) throw new RuntimeException($message);
    }
}
