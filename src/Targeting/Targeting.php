<?php

namespace WConvert\Targeting;

defined('ABSPATH') || exit;

/**
 * An Optin's Targeting axis: which pages it may appear on, and to whom.
 *
 * Two lists of page rules with exclude beating include, plus one visitor
 * predicate. `logged_in` is a FIELD rather than a member of those lists on
 * purpose: an include list is a UNION of page sets, so a visitor rule dropped
 * into it would widen the Optin to the whole site for anyone who matched.
 * Held apart, the axis reads as `page-set AND logged_in`, which is the
 * implicit AND ADR 0005 gives every axis.
 *
 * It is on the server axis at all only because the client cannot read
 * WordPress's HttpOnly auth cookie.
 *
 * @since 0.1.0
 */
final class Targeting
{
    /**
     * @param list<TargetingRule> $include
     * @param list<TargetingRule> $exclude
     */
    public function __construct(
        public readonly array $include = [],
        public readonly array $exclude = [],
        public readonly ?bool $loggedIn = null,
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
        );
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

        return $out;
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
