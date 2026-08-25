<?php

namespace WConvert\Rules;

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
 * @since 0.1.0
 */
final class RuleVocabulary
{
    /**
     * @param array<string, RuleKind> $kinds Rule type => its declared kind.
     * @param array<string, string> $values Rule type => what its value IS, where it takes one.
     */
    private function __construct(
        private readonly array $kinds,
        private readonly array $values = [],
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
        $values = [];

        foreach ($manifest as $axis) {
            if (!is_array($axis)) {
                continue;
            }

            foreach ($axis as $type => $entry) {
                $kind = is_array($entry) && is_string($entry['kind'] ?? null)
                    ? RuleKind::tryFrom($entry['kind'])
                    : null;

                if ($kind === null) {
                    continue;
                }

                $kinds[(string) $type] = $kind;

                if (is_array($entry) && is_string($entry['value'] ?? null)) {
                    $values[(string) $type] = $entry['value'];
                }
            }
        }

        return new self($kinds, $values);
    }

    public function kindOf(string $type): ?RuleKind
    {
        return $this->kinds[$type] ?? null;
    }

    /**
     * What a rule type's value IS — `post_id`, `post_type`, `path_glob`,
     * `seconds` — or null where the type takes none.
     *
     * Read by [[Playbook]] registration, which refuses an entry naming
     * anything only one site has. Which types those are follows from this
     * field: `post_id` and `term_id` are ids, `post_type` and `path_glob`
     * mean the same thing on every install. Listing them again beside the
     * validator would be the fifth hand-maintained cross-cutting list this
     * project has refused (ADR 0019), and the one most likely to be forgotten
     * the day a sixth targeting type lands.
     */
    public function valueOf(string $type): ?string
    {
        return $this->values[$type] ?? null;
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
            if (is_array($rule) && is_string($rule['type'] ?? null) && $this->isClientRule($rule['type'])) {
                /** @var array<string, mixed> $rule */
                $kept[] = $rule;
            }
        }

        return $kept;
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
                $partitioned[$axis][] = $rule;
            }
        }

        return $partitioned;
    }
}
