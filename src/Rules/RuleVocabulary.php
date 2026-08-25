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
     */
    private function __construct(
        private readonly array $kinds,
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

        foreach ($manifest as $axis) {
            if (!is_array($axis)) {
                continue;
            }

            foreach ($axis as $type => $entry) {
                $kind = is_array($entry) && is_string($entry['kind'] ?? null)
                    ? RuleKind::tryFrom($entry['kind'])
                    : null;

                if ($kind !== null) {
                    $kinds[(string) $type] = $kind;
                }
            }
        }

        return new self($kinds);
    }

    public function kindOf(string $type): ?RuleKind
    {
        return $this->kinds[$type] ?? null;
    }

    /**
     * The same rule list, with everything {@see self::partition()} would drop
     * already gone — and still flat.
     *
     * Called on the way IN, so an unrecognised rule cannot sit in `config`
     * until the day someone publishes it. The vocabulary names BOTH tiers, so
     * nothing dropped here is a premium rule an install merely lacks the code
     * for; what is dropped is a typo.
     *
     * @param mixed $rules
     * @return list<array<string, mixed>>
     */
    public function normalize($rules): array
    {
        $partitioned = $this->partition($rules);

        return [...$partitioned['triggers'], ...$partitioned['conditions']];
    }

    /**
     * Split a flat `{type, scalar}` rule list into the two client axes.
     *
     * Two things are dropped rather than carried, and for the same reason:
     *
     * - **A type the manifest does not declare.** The vocabulary is closed, so
     *   an unknown type is a mistake, not an extension — and a stray CONDITION
     *   reaching the payload would fail shut in the evaluator and suspend the
     *   Optin for a reason that is a bug rather than a missing dependency
     *   (ADR 0029).
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
