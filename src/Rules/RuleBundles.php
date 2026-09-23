<?php

namespace WConvert\Rules;

defined('ABSPATH') || exit;

/**
 * [[Starting point]]s: a named set of rules a merchant can begin from.
 *
 * ============================================================================
 * NOT CALLED PRESETS, AND THE NAME IS THE DECISION.
 * ============================================================================
 * `preset` already means a per-type shortcut in this codebase — {@see RuleLabels::presets()},
 * `resources/admin/src/builder/presets.ts`, the `presets` key of every
 * manifest entry. Two meanings of one word on one screen is the collision
 * CONTEXT.md's glossary exists to prevent, and this screen would have shown
 * both at once: a Starting point that lands *"after a few seconds"* is a
 * bundle whose content is a preset.
 *
 * ============================================================================
 * NOT A FIFTH AXIS IN THE MANIFEST, AND NOT THE PLAYBOOK MECHANISM.
 * ============================================================================
 * **The manifest was rejected** because {@see RuleVocabulary::fromArray()}
 * iterates `$manifest as $axis => $entries` — a `bundles` key would be
 * swallowed as an axis of entries with no `kind`, silently — and because the
 * words would then be in JSON, which `wp i18n make-pot` cannot see (ADR 0013).
 * PHP returning an array is the same answer a [[Playbook]] got, for the same
 * reason.
 *
 * **The Playbook mechanism was rejected** because applying a Playbook runs
 * `snapshotInto()` and writes COPY over the Optin. There is no reading under
 * which "start my rules from this" means "replace my headline".
 *
 * ============================================================================
 * A BUNDLE NAMES SECTIONS, AND APPLYING REPLACES ONLY THE ONES IT NAMES.
 * ============================================================================
 * The rules panel is four sections — Where, When, Who, How often — and a
 * bundle carrying only Conditions must leave the merchant's [[Trigger]]s
 * alone. An Optin with no Trigger can never fire and the save route refuses
 * one outright, so a bundle that replaced the whole flat list would be a
 * button that breaks the Optin it was offered to improve.
 *
 * That is why the rules here are declared FLAT and split by
 * {@see RuleVocabulary::partition()} at description time rather than filed
 * under a section by hand: kind is a fixed property of the type, so a bundle
 * cannot file a Condition under When by mistake (ADR 0005).
 *
 * ============================================================================
 * A RULE NAMES A PRESET WHERE ONE EXISTS. IT DOES NOT RETYPE ITS VALUES.
 * ============================================================================
 * `['type' => 'time_on_page', 'preset' => 'after_a_read']` rather than
 * `['seconds' => 15]`. The manifest already says what `after_a_read` fixes, and
 * a second copy of 15 here is a number that drifts the day somebody retunes the
 * preset — silently, because both are valid rules and nothing compares them.
 * {@see RuleCatalogue::bundles()} expands it against the vocabulary, so the
 * manifest stays the one place a preset's values are written (ADR 0005).
 *
 * Params are still written out where the type has no preset to name — a
 * `singular` targeting rule, an allowance. What is forbidden is retyping values
 * the manifest already holds.
 *
 * **No `authored` param is ever supplied.** `post.value`, `term.value`,
 * `click_element.selector` and `cart_value_min.amount` name something only one
 * site has, and a bundle is written here, once, for every install — the same
 * rule a Playbook is held to (ADR 0012).
 *
 * @since 0.1.0
 */
final class RuleBundles
{
    /**
     * Every Starting point, in the order the panel offers them.
     *
     * Free ones first, which is not decoration: a free install's list would
     * otherwise open with the ones it cannot use.
     *
     * @return array<string, array<string, mixed>>
     */
    public static function all(): array
    {
        return [
            'after-a-read' => [
                // NOT "Once they have read a while" — that is `time_on_page`'s
                // own preset label, and both render in this panel. A Starting
                // point names an OUTCOME; a preset names a rule setting.
                'label' => __('Give them time to read', 'wconvert'),
                'description' => __(
                    'Opens after 15 seconds on the page, when the campaign’s other conditions allow it.',
                    'wconvert'
                ),
                'rules' => [['type' => 'time_on_page', 'preset' => 'after_a_read']],
            ],

            'halfway-down' => [
                'label' => __('Wait until they scroll', 'wconvert'),
                'description' => __(
                    'Opens after the visitor reaches 50% of the page’s scrollable distance.',
                    'wconvert'
                ),
                'rules' => [['type' => 'scroll_depth', 'preset' => 'halfway_down']],
            ],

            'blog-posts-only' => [
                'label' => __('Only on blog posts', 'wconvert'),
                'description' => __(
                    'Limits page selection to individual blog posts. Replaces existing page inclusions and exclusions.',
                    'wconvert'
                ),
                'targeting' => ['include' => [['type' => 'singular', 'value' => 'post']]],
            ],

            'show-it-once' => [
                'label' => __('One automatic appearance per browser', 'wconvert'),
                'description' => __(
                    'Allows one automatic appearance in each browser. Clearing browser data resets this limit.',
                    'wconvert'
                ),
                'frequency' => ['maxImpressions' => 1],
            ],

            'mobile-visitors' => [
                'label' => __('Mobile visitors only', 'wconvert'),
                'description' => __('Limits the audience to mobile-sized browser windows. Replaces existing audience rules.', 'wconvert'),
                'rules' => [['type' => 'device', 'preset' => 'mobile_only']],
            ],

            'after-inactivity' => [
                'label' => __('Reach visitors who pause', 'wconvert'),
                'description' => __('Opens after 30 seconds without activity while the page stays visible.', 'wconvert'),
                'rules' => [['type' => 'inactivity', 'seconds' => 30]],
            ],

            'once-per-session' => [
                'label' => __('Avoid repeating in the same visit', 'wconvert'),
                'description' => __('One automatic appearance per browser tab session. Stops after the visitor completes the campaign.', 'wconvert'),
                'frequency' => ['maxPerSession' => 1, 'stopAfterDismiss' => false, 'stopAfterConversion' => true],
            ],

            'space-out-visits' => [
                'label' => __('Leave a week between appearances', 'wconvert'),
                'description' => __('Waits 7 days between automatic appearances in the same browser. Stops after completion.', 'wconvert'),
                'frequency' => ['cooldownDays' => 7, 'stopAfterDismiss' => false, 'stopAfterConversion' => true],
            ],

            'on-the-way-out' => [
                'label' => __('As they are leaving', 'wconvert'),
                'description' => __(
                    'Opens when the pointer leaves through the top of the page. Does not detect leaving on touch-only visits.',
                    'wconvert'
                ),
                'rules' => [['type' => 'exit_intent']],
            ],

            'leaving-or-scrolling-back' => [
                'label' => __('Catch a change of direction', 'wconvert'),
                'description' => __('Opens when the pointer leaves through the top OR the visitor scrolls down then back up. The scroll option also works on touch screens.', 'wconvert'),
                'rules' => [['type' => 'exit_intent'], ['type' => 'scroll_up']],
            ],

            'rescue-a-cart' => [
                'label' => __('Remind shoppers before they leave', 'wconvert'),
                'description' => __(
                    'For shoppers with items in their WooCommerce cart, opens when the pointer leaves through the top. Touch-only visits need another opening rule.',
                    'wconvert'
                ),
                'rules' => [['type' => 'cart_has_items'], ['type' => 'exit_intent']],
            ],
        ];
    }

    /**
     * Every rule type one bundle names, across every section it touches.
     *
     * What {@see RuleCatalogue} needs to resolve the bundle's own
     * [[Availability]], and the reason it is asked here rather than computed
     * there from three separate keys: a bundle that grows a fourth section
     * must not be able to grow one this question does not reach.
     *
     * @param array<string, mixed> $bundle
     * @return list<string>
     */
    public static function typesIn(array $bundle): array
    {
        $types = [];

        foreach (is_array($bundle['rules'] ?? null) ? $bundle['rules'] : [] as $rule) {
            if (is_array($rule) && is_string($rule['type'] ?? null)) {
                $types[] = $rule['type'];
            }
        }

        $targeting = is_array($bundle['targeting'] ?? null) ? $bundle['targeting'] : [];

        foreach (['include', 'exclude'] as $list) {
            foreach (is_array($targeting[$list] ?? null) ? $targeting[$list] : [] as $rule) {
                if (is_array($rule) && is_string($rule['type'] ?? null)) {
                    $types[] = $rule['type'];
                }
            }
        }

        // ====================================================================
        // THE VISITOR PREDICATES ARE FIELDS, SO THE LOOP ABOVE CANNOT SEE THEM.
        // ====================================================================
        // Each is held apart from the two lists on purpose — an include list
        // unions PAGE SETS, so a visitor rule in one would widen the Optin to
        // the whole site — and each is a rule type with a tier and a
        // [[SiteDependency]] like any other. A Starting point naming one has
        // to be judged on it.
        //
        // Keyed by the config key rather than derived, because that key is the
        // FIELD's name and only this file knows the two are the same thing:
        // `logged_in` is stored under its own type name and `roles` is the
        // plural of `role`. A third predicate adds a line here, and
        // `RuleManifestParityTest` is what makes anybody notice it should.
        foreach (['logged_in' => 'logged_in', 'roles' => 'role'] as $field => $type) {
            if (isset($targeting[$field])) {
                $types[] = $type;
            }
        }

        return array_values(array_unique($types));
    }
}
