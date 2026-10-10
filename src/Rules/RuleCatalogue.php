<?php

namespace WConvert\Rules;

use WConvert\Support\Availability;
use WConvert\Support\ProPresence;
use WConvert\Support\SiteDependency;
use WConvert\Support\SitePresence;
use WConvert\Targeting\RoleRegistry;

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
        // What this install can tell visitors apart by — WordPress's own roles,
        // and whatever a membership or LMS adapter registered beside them. It
        // is here rather than read from `wp_roles()` at the call site because
        // the whole point of the seam is that adding a source changes no file
        // ({@see \WConvert\Targeting\RoleRegistry}).
        private readonly RoleRegistry $roles,
    ) {
    }

    /**
     * Every axis, every type under each in manifest order.
     *
     * The Display rules [[Quick pick]]s are not here: they are client-only
     * (`rules/picks.ts`) and read their availability off these types (ADR 0129).
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function all(): array
    {
        $described = [];

        foreach ($this->vocabulary->axes() as $axis => $types) {
            // Runtime requirements are supplied by blocks, never authored in
            // the Display rules picker.
            if ($axis === 'requirements') {
                continue;
            }
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
            'signal' => $this->vocabulary->signalOf($type),
            'label' => RuleLabels::type($type),
            // The same rule read inside a sentence rather than over a control.
            // The rules panel's four section summaries are built from these,
            // and neither spelling can be derived from the other in any
            // language ({@see RuleLabels::phrases()}).
            'phrase' => RuleLabels::phrase($type),
            'tier' => $this->vocabulary->tierOf($type)?->value,
            'availability' => $this->availabilityOf($type)->value,
            // What the SITE is missing, in words, and **null unless that is
            // why this type is absent** — the cause or nothing, exactly as
            // {@see self::missingDependencyOf()} answers it.
            //
            // Without this the rules panel can name the gap for a `locked`
            // type and not for an `unavailable` one, which is how the two
            // screens came to disagree: {@see \WConvert\Optin\Suspension}
            // already tells this merchant their cart Condition needs
            // WooCommerce, while the panel that holds the rule said nothing
            // at all. Applying ADR 0026 rather than amending it — the
            // settings list explains a gap, and an explanation that cannot
            // name the missing plugin leaves them to guess which of their
            // plugins did it.
            //
            // The key is `requires_label` because
            // {@see \WConvert\Rest\DestinationController} already ships one
            // under that name for the same fact.
            'requires_label' => $this->missingDependencyOf($type)?->label(),
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
                'options' => $this->options($control, is_array($param['options'] ?? null) ? $param['options'] : []),
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
                // Null where a preset offers no phrase of its own, in which
                // case the summary falls back to the type's with the preset's
                // fixed values substituted back in. Not the same as an empty
                // string, which would summarise the rule as nothing at all.
                'phrase' => RuleLabels::presetPhrase($type, (string) $id),
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
    private function options(string $control, array $declared): array
    {
        if ($control === 'post_type') {
            return self::postTypes();
        }

        // The third source, and the one that is not only WordPress: every
        // role the site registered, plus whatever a membership or LMS adapter
        // offers beside them ({@see \WConvert\Targeting\RoleRegistry}). The
        // words are the site's for the reason a post type's are — a level's
        // name is whatever the merchant typed — and asking the registry rather
        // than `wp_roles()` is what makes an adapter need no change here.
        if ($control === 'role_set') {
            $options = [];

            foreach ($this->roles->offered() as $slug => $name) {
                $options[] = ['value' => $slug, 'label' => $name];
            }

            return $options;
        }

        $phrases = RuleLabels::optionPhrases();

        return array_values(array_map(
            static fn ($value): array => [
                'value' => (string) $value,
                'label' => RuleLabels::option($control, (string) $value),
                // How the option reads inside a sentence, where its label cannot.
                ...(isset($phrases[$control . '.' . $value]) ? ['phrase' => $phrases[$control . '.' . $value]] : []),
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
