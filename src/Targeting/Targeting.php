<?php

namespace WConvert\Targeting;

defined('ABSPATH') || exit;

/**
 * An Optin's Targeting axis: which pages it may appear on, and to whom.
 *
 * Two lists of page rules with exclude beating include, plus the visitor
 * predicates. `logged_in` and `roles` are FIELDS rather than members of those
 * lists on purpose: an include list is a UNION of page sets, so a visitor rule
 * dropped into one would not narrow the Optin — it would WIDEN it to the whole
 * site for anyone who matched. Held apart, the axis reads as
 * `page-set AND logged_in AND roles`, which is the implicit AND ADR 0005 gives
 * every axis.
 *
 * **That failure is silent and site-wide**, so it is closed structurally
 * rather than by review: {@see TargetingType} enumerates the page rules and
 * nothing else, so {@see TargetingRule::fromArray()} drops a visitor type on
 * the way in and there is no way to build one inside a list at all.
 * `RuleManifestParityTest::testAVisitorPredicateIsUnbuildableInsideEitherList()`
 * walks the manifest's own visitor half, so a third predicate is covered the
 * day it is declared.
 *
 * They are on the server axis at all only because the client cannot read
 * WordPress's HttpOnly auth cookie. That stays true for `roles`, and more so:
 * a membership level is a fact another plugin holds in the database.
 *
 * @since 0.1.0
 */
final class Targeting
{
    /**
     * @param list<TargetingRule> $include
     * @param list<TargetingRule> $exclude
     * @param list<string>|null $roles Which roles or memberships a visitor must
     *   hold ANY of — never all, because the real OR cases are one rule
     *   carrying several values (ADR 0005). Null is *do not ask*, and it is not
     *   the same as an empty list, which is why an emptied control stores
     *   nothing rather than a list nobody can satisfy.
     */
    public function __construct(
        public readonly array $include = [],
        public readonly array $exclude = [],
        public readonly ?bool $loggedIn = null,
        public readonly ?array $roles = null,
    ) {
    }

    /**
     * @param array<string, mixed> $config
     */
    public static function fromArray(array $config): self
    {
        return new self(
            self::rules($config['include'] ?? []),
            self::rules($config['exclude'] ?? []),
            // Unset means "do not ask", which is not the same as false.
            isset($config['logged_in']) ? (bool) $config['logged_in'] : null,
            self::roles($config['roles'] ?? null),
        );
    }

    /**
     * Does either list hold a rule of this type?
     *
     * Asked by the request-context factory, because resolving a post's terms
     * is a query and nobody should pay for it on a page where no published
     * Optin targets a term. It lives HERE rather than there so the question is
     * asked of the enum rather than of a string literal the manifest parity
     * test cannot see (ADR 0005).
     */
    public function usesType(TargetingType $type): bool
    {
        foreach ([...$this->include, ...$this->exclude] as $rule) {
            if ($rule->type === $type) {
                return true;
            }
        }

        return false;
    }

    /**
     * Back to storage, with every rule the vocabulary does not know already
     * dropped by {@see self::fromArray()}.
     *
     * Round-tripping config through this on write is what keeps an unknown
     * rule type from sitting in `config` until the day it is published.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $out = [];

        if ($this->include !== []) {
            $out['include'] = array_map(static fn (TargetingRule $r): array => $r->toArray(), $this->include);
        }

        if ($this->exclude !== []) {
            $out['exclude'] = array_map(static fn (TargetingRule $r): array => $r->toArray(), $this->exclude);
        }

        if ($this->loggedIn !== null) {
            $out['logged_in'] = $this->loggedIn;
        }

        if ($this->roles !== null) {
            $out['roles'] = $this->roles;
        }

        return $out;
    }

    /**
     * The roles a merchant chose, or **null where they chose none**.
     *
     * An empty list collapses to null rather than being stored, and the two
     * would otherwise be a real ambiguity: read as a set, an empty one holds
     * for nobody, and an Optin that is published and can never show is a state
     * the merchant has no word for. An emptied control means *any role*, which
     * is *do not ask*.
     *
     * Slugs are strings and nothing else — a role is a key another system
     * minted, never a number — and anything that is not one is dropped rather
     * than cast, because `(string) []` is a warning and a rule nobody meant.
     *
     * @param mixed $roles
     * @return list<string>|null
     */
    private static function roles($roles): ?array
    {
        if (!is_array($roles)) {
            return null;
        }

        $chosen = [];

        foreach ($roles as $role) {
            if (is_string($role) && $role !== '') {
                $chosen[] = $role;
            }
        }

        $chosen = array_values(array_unique($chosen));

        return $chosen === [] ? null : $chosen;
    }

    /**
     * @param mixed $entries
     * @return list<TargetingRule>
     */
    private static function rules($entries): array
    {
        if (!is_array($entries)) {
            return [];
        }

        $rules = [];

        foreach ($entries as $entry) {
            $rule = TargetingRule::fromArray($entry);

            if ($rule !== null) {
                $rules[] = $rule;
            }
        }

        return $rules;
    }
}
