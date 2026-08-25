<?php

namespace WConvert\Rules;

use WConvert\Support\Availability;
use WConvert\Support\ProPresence;

defined('ABSPATH') || exit;

/**
 * The rule vocabulary as the builder needs it: the manifest, plus the two
 * things the manifest cannot carry.
 *
 * **The words**, which live in PHP so `wp i18n make-pot` can see them
 * ({@see RuleLabels}) — ADR 0013's split, read from the other end. **And
 * [[Availability]]**, which is a fact about this install and is resolved here
 * so no surface recombines two booleans in an order of its own (ADR 0026).
 *
 * That is also why the builder fetches this rather than importing the manifest
 * the way it imports the template vocabulary: a Template's vocabulary is the
 * same on every install, and a rule's is not.
 *
 * **A `locked` type is described, not filtered out.** The rules panel is a
 * settings list the merchant went hunting through, and such a list EXPLAINS a
 * gap — silence there is baffling. It is the creation flow's front door that
 * hides one (ADR 0026). The strip that keeps an unentitled rule off a page
 * happens at enqueue, where it can actually hold.
 *
 * Beside {@see RuleVocabulary} rather than inside it, because that class is
 * what PHP's own runtime reads on every publish and this is read once, by one
 * screen. A `WP_REST_Response` is the controller's; everything down to it is
 * here, where it can be tested without WordPress's REST classes.
 *
 * @since 0.1.0
 */
final class RuleCatalogue
{
    public function __construct(
        private readonly RuleVocabulary $vocabulary,
        private readonly ProPresence $pro,
    ) {
    }

    /**
     * Every axis, and every type under each, in manifest order.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function all(): array
    {
        $described = [];

        foreach ($this->vocabulary->axes() as $axis => $types) {
            $described[$axis] = array_map(fn (string $type): array => $this->describe($type), $types);
        }

        return $described;
    }

    /**
     * One rule type, whole.
     *
     * @return array<string, mixed>
     */
    private function describe(string $type): array
    {
        $tier = $this->vocabulary->tierOf($type);

        return [
            'type' => $type,
            'kind' => $this->vocabulary->kindOf($type)?->value,
            'label' => RuleLabels::type($type),
            'tier' => $tier?->value,
            // No rule type declares a [[SiteDependency]] in v1 — the cart
            // Conditions that would are not in the vocabulary yet — so the
            // site can serve every one of them and the only question left is
            // the tier. Passed rather than assumed, so the day a cart
            // Condition lands the arithmetic is already the shared one and
            // `unavailable` still beats `locked` (ADR 0026).
            'availability' => Availability::of(true, $tier?->isSuppliedBy($this->pro) ?? true)->value,
            'params' => $this->params($type),
            'presets' => $this->presets($type),
        ];
    }

    /**
     * @return array<string, array<string, mixed>>
     */
    private function params(string $type): array
    {
        $described = [];

        foreach ($this->vocabulary->paramsOf($type) as $name => $param) {
            $control = is_string($param['control'] ?? null) ? $param['control'] : 'text';

            $described[$name] = [
                'control' => $control,
                'label' => RuleLabels::param($type, (string) $name),
                'authored' => ($param['authored'] ?? false) === true,
                'options' => self::options($control, is_array($param['options'] ?? null) ? $param['options'] : []),
            ];
        }

        return $described;
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function presets(string $type): array
    {
        $described = [];

        foreach ($this->vocabulary->presetsOf($type) as $id => $fixed) {
            $described[] = [
                'id' => $id,
                'label' => RuleLabels::preset($type, (string) $id),
                'fixed' => $fixed,
            ];
        }

        return $described;
    }

    /**
     * A param's options, where it has a closed set.
     *
     * Two sources and one shape. A set the vocabulary knows when it is WRITTEN
     * — the three device buckets — comes off the manifest and is named by
     * {@see RuleLabels}. A set that is a fact about the INSTALL comes from
     * WordPress, which already holds the merchant's own words for it: a custom
     * post type's label is whatever its author registered, and no list of ours
     * could know it.
     *
     * @param array<mixed> $declared
     * @return list<array<string, string>>
     */
    private static function options(string $control, array $declared): array
    {
        if ($control === 'post_type') {
            return self::postTypes();
        }

        return array_values(array_map(
            static fn ($value): array => [
                'value' => (string) $value,
                'label' => RuleLabels::option($control, (string) $value),
            ],
            array_filter($declared, 'is_scalar')
        ));
    }

    /**
     * @return list<array<string, string>>
     */
    private static function postTypes(): array
    {
        $options = [];

        foreach (get_post_types(['public' => true], 'objects') as $name => $type) {
            $label = is_object($type) && isset($type->labels->singular_name)
                ? (string) $type->labels->singular_name
                : '';

            $options[] = ['value' => (string) $name, 'label' => $label === '' ? (string) $name : $label];
        }

        return $options;
    }
}
