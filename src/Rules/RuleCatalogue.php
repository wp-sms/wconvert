<?php

namespace WConvert\Rules;

use WConvert\Support\Availability;
use WConvert\Support\ProPresence;
use WConvert\Support\SiteDependency;
use WConvert\Support\SitePresence;

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
        // Beside Pro's presence rather than folded into it: a missing tier is
        // buyable from us and a missing plugin is not, and collapsing the two
        // shows a Pro customer an advertisement for Pro (ADR 0026).
        private readonly SitePresence $site,
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
     * One rule type's [[Availability]] on this install.
     *
     * The one place the arithmetic is done for a rule type, because
     * `unavailable` beating `locked` must not be re-derived per surface: a
     * merchant with no store is never sold Pro for a feature Pro would not
     * give them either (ADR 0026).
     *
     * Public because a second screen asks it now. {@see \WConvert\Optin\Suspension}
     * turns "this Optin cannot run rule X" into the sentence the Optin list
     * shows — *"Suspended — WConvert Pro is not active"* — and the difference
     * between a missing tier and a missing plugin is exactly what decides
     * whether that sentence may carry an upsell.
     */
    public function availabilityOf(string $type): Availability
    {
        $requires = $this->vocabulary->requiresOf($type);

        // **Both halves, and `unavailable` beats `locked`.** The precedence is
        // {@see Availability::of()}'s rather than an order written out here,
        // so a merchant with no store is never sold Pro for a feature Pro
        // would not give them either (ADR 0026). Until #36's cart Conditions
        // no rule type named a dependency and the first argument was the
        // literal `true`; what changed is the manifest gaining `requires`, not
        // the arithmetic.
        return Availability::of(
            $requires === null || $this->site->has($requires),
            $this->vocabulary->tierOf($type)?->isSuppliedBy($this->pro) ?? true
        );
    }

    /**
     * The [[SiteDependency]] this rule type is missing **where that is why it
     * is absent here** — and null where the cause is the tier, or where it is
     * not absent at all.
     *
     * ========================================================================
     * ONE FACT RATHER THAN TWO COORDINATES, BECAUSE ONLY ONE COMBINATION IS
     * REAL.
     * ========================================================================
     * The surface that needs this is {@see \WConvert\Optin\Suspension},
     * which turns it into the sentence on the Optin list: `unavailable` says a
     * dependency is missing and nothing more, and a row reading *"Suspended —
     * not available on this site"* leaves a merchant who deactivated
     * WooCommerce to guess which of their plugins did it.
     *
     * Handing that surface an {@see Availability} AND a dependency would let
     * it hold a pair that cannot occur — `unavailable` with nothing to name —
     * and a branch for that pair is dead code arguing it is defensive. So the
     * two are resolved together, here, and what comes back is the cause or
     * nothing.
     *
     * **The precedence is still {@see Availability::of()}'s and is not
     * re-derived.** This asks the shared arithmetic which half won and answers
     * with the dependency only where the SITE's did — so a rule declaring a
     * dependency the site HAS is `locked` and reads as null here, which is
     * what stops a free install with a store being told it needs WooCommerce
     * (ADR 0026).
     */
    public function missingDependencyOf(string $type): ?SiteDependency
    {
        return $this->availabilityOf($type) === Availability::Unavailable
            ? $this->vocabulary->requiresOf($type)
            : null;
    }

    /**
     * One rule type, whole.
     *
     * @return array<string, mixed>
     */
    private function describe(string $type): array
    {
        return [
            'type' => $type,
            'kind' => $this->vocabulary->kindOf($type)?->value,
            'label' => RuleLabels::type($type),
            'tier' => $this->vocabulary->tierOf($type)?->value,
            'availability' => $this->availabilityOf($type)->value,
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
