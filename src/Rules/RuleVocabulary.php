<?php

namespace WConvert\Rules;

use WConvert\Support\Tier;

defined('ABSPATH') || exit;

/**
 * The rule manifest, read as a vocabulary — and the publish-time partition
 * that is the only thing PHP does with the two client axes.
 *
 * PHP never evaluates a Trigger or a Condition. What it knows about them is
 * their KIND, and that is enough to do the one job ADR 0005 gives it here:
 * split an Optin's flat rule list into `triggers` and `conditions` **at publish
 * time, not at evaluation time** — "the manifest already knows the answer and
 * the client should not re-derive it per page view".
 *
 * Built once and passed as an object, for the reason {@see \WConvert\Optin\PublishedOptin}
 * gives: letting the raw manifest array travel means every reader downstream
 * spells a rule type as a string literal the parity test cannot see.
 *
 * ============================================================================
 * PARAMS ARE DECLARED, NOT IMPLIED.
 * ============================================================================
 * Each entry declares the KEYS its scalar arrives under and the control each
 * one takes — `time_on_page` is `{seconds}`, `device` is `{in}`, `query_param`
 * is `{key, value}`. That used to be implicit and known only to the loader
 * module that read it, which is how three of the four bundled [[Playbook]]s
 * shipped `['type' => 'time_on_page', 'value' => 8]` against a module reading
 * `rule.seconds`: a Trigger that could never fire, on a prefilled Optin, with
 * nothing in any log. The builder needs the keys anyway — it is the screen
 * that fills them in — so writing them where both runtimes already read is the
 * fix and the feature at once.
 *
 * **`authored` is the half a [[Playbook]] may not supply.** A param marked so
 * names something only one site has: a post id, a term id, a CSS selector.
 * That single declaration is what refuses a Playbook naming a post id and what
 * keeps `click_element`'s selector blank in any Playbook-prefilled Optin
 * (ADR 0012) — one rule rather than an id heuristic beside a selector special
 * case.
 *
 * ============================================================================
 * AND THE TWO FIELDS DEGRADATION READS.
 * ============================================================================
 * `on_absence` says what happens to an Optin holding a rule this install
 * cannot evaluate ({@see OnAbsence}), and `substitute` names the rule that
 * runs in its place. Both are declared HERE, on the entry, because the
 * manifest is the only place a substitution may be declared: a
 * [[Playbook]]-owned fallback lets a remotely-sourced entry declare what runs
 * in place of a feature it cannot have, which is capability rather than
 * content, and a standalone table is the fourth hand-maintained list this
 * design has now refused four times (ADR 0012).
 *
 * @since 0.1.0
 */
final class RuleVocabulary
{
    /**
     * The one key a stored rule may carry that is not a param of its type.
     *
     * It is PROVENANCE — which rule this one stands in for — and it is the
     * on-screen surface of a degradation, so it has to survive
     * {@see self::normalize()} without being declared as a param. Declared as
     * a param it would draw a control in the builder and invite the merchant
     * to edit the record of a substitution.
     */
    public const DEGRADED_FROM = 'degraded_from';

    /**
     * @param array<string, RuleKind> $kinds Rule type => its declared kind.
     * @param array<string, Tier> $tiers Rule type => which install supplies it.
     * @param array<string, array<string, array<string, mixed>>> $params Rule type => param name => its declaration.
     * @param array<string, array<string, array<string, mixed>>> $presets Rule type => preset id => the values it fixes.
     * @param array<string, list<string>> $axes Axis name => its types, in manifest order.
     * @param array<string, OnAbsence> $onAbsence Rule type => what happens where this install cannot evaluate it.
     * @param array<string, array<string, mixed>> $substitutes Rule type => the rule that runs in its place.
     */
    private function __construct(
        private readonly array $kinds,
        private readonly array $tiers = [],
        private readonly array $params = [],
        private readonly array $presets = [],
        private readonly array $axes = [],
        private readonly array $onAbsence = [],
        private readonly array $substitutes = [],
    ) {
    }

    public static function fromManifest(string $pluginDir = WCONVERT_DIR): self
    {
        return self::fromArray(RuleManifest::load($pluginDir));
    }

    /**
     * @param array<string, mixed> $manifest The decoded manifest, whole.
     */
    public static function fromArray(array $manifest): self
    {
        $kinds = [];
        $tiers = [];
        $params = [];
        $presets = [];
        $axes = [];
        $onAbsence = [];
        $substitutes = [];

        foreach ($manifest as $axis => $entries) {
            if (!is_array($entries)) {
                continue;
            }

            $axes[(string) $axis] = [];

            foreach ($entries as $type => $entry) {
                $kind = is_array($entry) && is_string($entry['kind'] ?? null)
                    ? RuleKind::tryFrom($entry['kind'])
                    : null;

                if ($kind === null) {
                    continue;
                }

                $type = (string) $type;
                $axes[(string) $axis][] = $type;
                $kinds[$type] = $kind;
                $tiers[$type] = Tier::tryFrom(is_string($entry['tier'] ?? null) ? $entry['tier'] : '') ?? Tier::Free;
                $params[$type] = self::declarations($entry['params'] ?? []);
                $presets[$type] = self::declarations($entry['presets'] ?? []);
                // **Absent means `drop`.** ADR 0012 is the rule and ADR 0027
                // is the marked exception, so an entry that says nothing
                // behaves as the rule — which is what keeps `suspend`
                // something somebody chose rather than something a schema
                // handed out.
                $onAbsence[$type] = OnAbsence::tryFrom(
                    is_string($entry['on_absence'] ?? null) ? $entry['on_absence'] : ''
                ) ?? OnAbsence::Drop;

                if (is_array($entry['substitute'] ?? null) && is_string($entry['substitute']['type'] ?? null)) {
                    /** @var array<string, mixed> $substitute */
                    $substitute = $entry['substitute'];
                    $substitutes[$type] = $substitute;
                }
            }
        }

        return new self($kinds, $tiers, $params, $presets, $axes, $onAbsence, $substitutes);
    }

    public function kindOf(string $type): ?RuleKind
    {
        return $this->kinds[$type] ?? null;
    }

    /**
     * Which install supplies this rule type. Free for anything the manifest
     * does not say otherwise about, and null for a type it does not declare.
     */
    public function tierOf(string $type): ?Tier
    {
        return $this->tiers[$type] ?? null;
    }

    /**
     * Every CLIENT rule type declared at one tier, in manifest order.
     *
     * This is what free and [[Pro]] each register into {@see SuppliedRules},
     * and it is why the premium split still adds **zero new lists** (ADR 0015):
     * neither side names a rule type, each asks the one manifest for the types
     * filed under its own tier.
     *
     * Client types only. Targeting is answered on the server by code both
     * installs carry, so it is never absent and has nothing to register.
     *
     * @return list<string>
     */
    public function typesAt(Tier $tier): array
    {
        $types = [];

        foreach (array_keys($this->kinds) as $type) {
            $type = (string) $type;

            if ($this->tierOf($type) === $tier && $this->isClientRule($type)) {
                $types[] = $type;
            }
        }

        return $types;
    }

    /**
     * What happens to an Optin holding this rule where the install cannot
     * evaluate it. `drop` for anything the manifest does not say otherwise
     * about, which is ADR 0012's rule; ADR 0027 is the marked exception.
     */
    public function onAbsenceOf(string $type): OnAbsence
    {
        return $this->onAbsence[$type] ?? OnAbsence::Drop;
    }

    /**
     * The rule that runs in place of this one, or null where nothing does.
     *
     * A COMPLETE rule — `{type, ...params}` — rather than a bare type name,
     * because a Trigger with no params can never fire: `time_on_page` reads
     * `rule.seconds` and `Number(undefined)` is NaN, so a substitution naming
     * only the type would swap one silent, total loss of function for another.
     * `tests/unit/Rules/RuleManifestParityTest.php` asserts every declared
     * substitute names a free type of the same kind and fills every param that
     * type declares.
     *
     * @return array<string, mixed>|null
     */
    public function substituteFor(string $type): ?array
    {
        return $this->substitutes[$type] ?? null;
    }

    /**
     * Every axis the manifest declares, and the types under each, in the order
     * they were written.
     *
     * Order is the merchant's: the builder lists Triggers and Conditions in
     * it, so a type moved in the manifest moves on screen and nothing else has
     * to be edited to agree.
     *
     * @return array<string, list<string>>
     */
    public function axes(): array
    {
        return $this->axes;
    }

    /**
     * What a rule type's params ARE — the keys its scalar arrives under, and
     * the control each takes.
     *
     * @return array<string, array<string, mixed>>
     */
    public function paramsOf(string $type): array
    {
        return $this->params[$type] ?? [];
    }

    /**
     * The legible shortcuts the builder ships over this type's general form —
     * preset id => the params it fixes.
     *
     * **A preset cannot introduce a type of its own**, and that is structural
     * rather than checked: a preset is declared INSIDE the entry for the type
     * it fixes params on, so there is no field for it to name a second one
     * with. "One engine type, many UI presets" (ADR 0005) is therefore a shape
     * here, not a rule someone has to keep.
     *
     * @return array<string, array<string, mixed>>
     */
    public function presetsOf(string $type): array
    {
        return $this->presets[$type] ?? [];
    }

    /**
     * Params of this type a [[Playbook]] may not supply, because they name
     * something only one site has.
     *
     * @return list<string>
     */
    public function authoredParamsOf(string $type): array
    {
        return array_keys(array_filter(
            $this->paramsOf($type),
            static fn (array $param): bool => ($param['authored'] ?? false) === true
        ));
    }

    /**
     * The same rule list, with everything {@see self::partition()} would drop
     * already gone — still flat, and still in the merchant's order.
     *
     * Called on the way IN, so an unrecognised rule cannot sit in `config`
     * until the day someone publishes it. The vocabulary names BOTH tiers, so
     * nothing dropped here is a premium rule an install merely lacks the code
     * for; what is dropped is a typo.
     *
     * It filters rather than partitioning and re-flattening. Re-flattening
     * would silently reorder a merchant's rules into triggers-then-conditions
     * on every save, and the rule list is a screen they look at.
     *
     * **Params outside the type's declaration are dropped too**, for the
     * reason the type itself is: the vocabulary is closed, and a key no module
     * reads is a rule that silently never holds rather than an extension.
     *
     * **`degraded_from` is the one exception, and it is not a param.** It is
     * the marker {@see Degradation} writes beside a substituted rule, and the
     * builder renders it as a persistent inline note on the rule row — so it
     * has to survive a save. Declaring it as a param instead would draw a
     * control for it, which invites the merchant to edit the record of a
     * substitution. It is kept only where it names a rule type this
     * vocabulary declares: a marker pointing at nothing is junk in `config`
     * and a note nobody can read.
     *
     * @param mixed $rules
     * @return list<array<string, mixed>>
     */
    public function normalize($rules): array
    {
        if (!is_array($rules)) {
            return [];
        }

        $kept = [];

        foreach ($rules as $rule) {
            if (!is_array($rule) || !is_string($rule['type'] ?? null) || !$this->isClientRule($rule['type'])) {
                continue;
            }

            $narrowed = ['type' => $rule['type']];

            foreach (array_keys($this->paramsOf($rule['type'])) as $param) {
                if (array_key_exists($param, $rule)) {
                    $narrowed[$param] = $rule[$param];
                }
            }

            $marker = $rule[self::DEGRADED_FROM] ?? null;

            if (is_string($marker) && $this->kindOf($marker) !== null) {
                $narrowed[self::DEGRADED_FROM] = $marker;
            }

            $kept[] = $narrowed;
        }

        return $kept;
    }

    /**
     * Does this rule list name at least one Trigger **that could fire**?
     *
     * ========================================================================
     * COUNTING TRIGGERS IS NOT THE SAME AS HAVING ONE.
     * ========================================================================
     * **Every Optin has at least one, and "shows immediately" is the explicit
     * `page_load` Trigger rather than an empty list** (CONTEXT.md, Trigger).
     * A list holding `{"type": "time_on_page"}` and nothing else satisfies the
     * count and fails the rule: the loader module reads `rule.seconds`, and
     * `Number(undefined)` is NaN, so the comparison is false forever. That is
     * the same silent, total loss of function ADR 0012 names as this
     * category's defining support ticket, arriving through the builder instead
     * of through a [[Playbook]].
     *
     * So a Trigger counts when every param it declares has a value — **except
     * the `authored` ones**, which are the merchant's to fill in on their own
     * site and which a Playbook may not supply at all (ADR 0012). Requiring
     * one of those would refuse exactly the state prefill hands the merchant
     * to complete: a `click_element` naming the Trigger with the selector left
     * blank.
     *
     * Asked here rather than counted at each call site, so the Playbook
     * registry and the save route ask the vocabulary the same question rather
     * than two spellings of it.
     *
     * @param mixed $rules
     */
    public function hasTrigger($rules): bool
    {
        foreach ($this->partition($rules)['triggers'] as $rule) {
            if ($this->couldFire($rule)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Is every param this rule needs actually supplied?
     *
     * Emptiness is judged the way a form field is: an absent key, an empty
     * string and an empty set all mean "nothing was chosen". `false` and `0`
     * are values — a `scroll_depth` of 0 is "as soon as they arrive", which is
     * a rule somebody meant.
     *
     * @param array<string, mixed> $rule
     */
    private function couldFire(array $rule): bool
    {
        foreach ($this->paramsOf((string) $rule['type']) as $name => $param) {
            if (($param['authored'] ?? false) === true) {
                continue;
            }

            $value = $rule[$name] ?? null;

            if ($value === null || $value === '' || $value === []) {
                return false;
            }
        }

        return true;
    }

    private function isClientRule(string $type): bool
    {
        return in_array($this->kindOf($type), [RuleKind::Trigger, RuleKind::Condition], true);
    }

    /**
     * Split a flat `{type, scalar}` rule list into the two client axes.
     *
     * Two things are dropped rather than carried, and for the same reason:
     *
     * - **A type the manifest does not declare.** The vocabulary is closed, so
     *   an unknown type is a mistake, not an extension — and a stray CONDITION
     *   reaching the payload would fail shut in the evaluator, so the Optin
     *   would never show and nothing would say why. Not a [[Suspended]] Optin,
     *   which is a state with a cause the merchant can read; this one is a bug
     *   wearing its clothes (ADR 0029).
     * - **A Targeting type.** It is answered on the server and stripped from
     *   the payload (ADR 0005); one sitting in the client list would be
     *   evaluated twice or, since the loader has no implementation for it,
     *   never.
     *
     * @param mixed $rules The Optin's flat rule list, as stored.
     * @return array{triggers: list<array<string, mixed>>, conditions: list<array<string, mixed>>}
     */
    public function partition($rules): array
    {
        $partitioned = ['triggers' => [], 'conditions' => []];

        if (!is_array($rules)) {
            return $partitioned;
        }

        foreach ($rules as $rule) {
            if (!is_array($rule) || !is_string($rule['type'] ?? null)) {
                continue;
            }

            $axis = match ($this->kindOf($rule['type'])) {
                RuleKind::Trigger => 'triggers',
                RuleKind::Condition => 'conditions',
                default => null,
            };


            if ($axis !== null) {
                /** @var array<string, mixed> $rule */
                // **The marker does not travel.** It is provenance for the
                // builder — which rule this one stands in for — and nothing
                // that renders an Optin reads it, so on the page it is bytes
                // with no reader against a 2KB budget. The same rule
                // {@see \WConvert\Optin\PublishedProjection}'s `NOT_SHIPPED`
                // states one level up, applied where a rule is turned into
                // payload shape.
                unset($rule[self::DEGRADED_FROM]);

                $partitioned[$axis][] = $rule;
            }
        }

        return $partitioned;
    }

    /**
     * @param mixed $section
     * @return array<string, array<string, mixed>>
     */
    private static function declarations($section): array
    {
        $kept = [];

        foreach (is_array($section) ? $section : [] as $name => $declaration) {
            if (is_array($declaration)) {
                $kept[(string) $name] = $declaration;
            }
        }

        return $kept;
    }
}
