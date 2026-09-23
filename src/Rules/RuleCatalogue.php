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
     * Every axis, every type under each in manifest order — and the
     * [[Starting point]]s.
     *
     * A fourth key on the same response rather than a route of its own. It is
     * read by one screen at the same moment as the three axes, it is derived
     * from the same vocabulary against the same install, and a second route
     * would be a second permission check and a second round trip for a list
     * the panel cannot render without.
     *
     * @return array<string, list<array<string, mixed>>>
     */
    public function all(): array
    {
        $described = [];

        foreach ($this->vocabulary->axes() as $axis => $types) {
            $described[$axis] = array_map(fn (string $type): array => $this->describe($type), $types);
        }

        $described['bundles'] = $this->bundles();

        return $described;
    }

    /**
     * The [[Starting point]]s, each resolved against this install.
     *
     * ========================================================================
     * A BUNDLE IS AS AVAILABLE AS ITS LEAST AVAILABLE RULE.
     * ========================================================================
     * Offering "Rescue an abandoned cart" on a site with no store would land
     * two rules the site cannot evaluate and [[Suspend]] the Optin on the
     * spot. So the arithmetic runs here, over {@see self::availabilityOf()},
     * which keeps the ADR 0026 precedence in the one place that owns it: a
     * bundle whose rules are missing WooCommerce is `unavailable` and is never
     * sold as Pro, even when one of its other rules is genuinely premium.
     *
     * The sections a bundle NAMES are exactly the keys it comes back with, so
     * "applying replaces the axes it names" is readable off the response
     * rather than being a list the client keeps in step.
     *
     * @return list<array<string, mixed>>
     */
    public function bundles(): array
    {
        $described = [];

        foreach (RuleBundles::all() as $id => $bundle) {
            $availability = $this->leastOf(RuleBundles::typesIn($bundle));
            $partitioned = array_filter($this->vocabulary->partition($this->expand($bundle['rules'] ?? [])));

            $described[] = [
                'id' => (string) $id,
                'label' => (string) $bundle['label'],
                'description' => (string) $bundle['description'],
                'availability' => $availability->value,
                // The cause where the SITE is why, and null where the tier is
                // — the same one-fact-or-nothing shape {@see self::missingDependencyOf()}
                // answers with, so the card never has to recombine two
                // coordinates of its own.
                'requires_label' => $availability === Availability::Unavailable
                    ? $this->missingDependencyIn(RuleBundles::typesIn($bundle))?->label()
                    : null,
            ] + $partitioned + array_filter([
                'targeting' => $bundle['targeting'] ?? [],
                'frequency' => $bundle['frequency'] ?? [],
            ]);
        }

        return $described;
    }

    /**
     * A bundle's rules, with every named preset replaced by what it fixes.
     *
     * ========================================================================
     * THE MANIFEST STAYS THE ONE PLACE A PRESET'S VALUES ARE WRITTEN.
     * ========================================================================
     * A [[Starting point]] says `['type' => 'time_on_page', 'preset' =>
     * 'after_a_read']` and this turns it into `['seconds' => 15]`. Written out
     * in {@see RuleBundles} instead, the 15 would be a second copy that drifts
     * the day somebody retunes the preset — silently, because both are valid
     * rules and nothing would compare them (ADR 0005).
     *
     * **An unknown preset contributes nothing rather than a broken rule.** The
     * rule keeps its type and loses the reference, so it lands as the type's
     * general form with no params — which the builder draws and the merchant
     * can complete. `RuleBundlesTest` fails on one, so this is the shape of a
     * mistake that cannot ship rather than a fallback anybody relies on.
     *
     * @param mixed $rules
     * @return list<array<string, mixed>>
     */
    private function expand($rules): array
    {
        $expanded = [];

        foreach (is_array($rules) ? $rules : [] as $rule) {
            if (!is_array($rule) || !is_string($rule['type'] ?? null)) {
                continue;
            }

            $named = $rule['preset'] ?? null;
            unset($rule['preset']);

            $expanded[] = is_string($named)
                ? $rule + ($this->vocabulary->presetsOf($rule['type'])[$named] ?? [])
                : $rule;
        }

        return $expanded;
    }

    /**
     * The worst Availability among these rule types.
     *
     * Built from the same two booleans {@see Availability::of()} takes rather
     * than from a comparison over the three states, so `unavailable` beats
     * `locked` here for exactly the reason it does everywhere else and not
     * because an ordering was written out a second time (ADR 0026).
     *
     * @param list<string> $types
     */
    private function leastOf(array $types): Availability
    {
        $siteCanServeThemAll = true;
        $installHasEveryTier = true;

        foreach ($types as $type) {
            $availability = $this->availabilityOf($type);

            $siteCanServeThemAll = $siteCanServeThemAll && $availability !== Availability::Unavailable;
            $installHasEveryTier = $installHasEveryTier && $availability !== Availability::Locked;
        }

        return Availability::of($siteCanServeThemAll, $installHasEveryTier);
    }

    /**
     * The first dependency missing among these types, for a bundle to name.
     *
     * @param list<string> $types
     */
    private function missingDependencyIn(array $types): ?SiteDependency
    {
        foreach ($types as $type) {
            $dependency = $this->missingDependencyOf($type);

            if ($dependency !== null) {
                return $dependency;
            }
        }

        return null;
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
