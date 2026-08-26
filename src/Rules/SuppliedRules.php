<?php

namespace WConvert\Rules;

defined('ABSPATH') || exit;

/**
 * The client rule types this install can actually evaluate — the **live
 * registry** ADR 0027 computes suspension against.
 *
 * ============================================================================
 * THIS IS ENFORCEMENT BY NON-REGISTRATION, AND THAT IS WHY IT IS NOT A TIER
 * QUESTION.
 * ============================================================================
 * Free registers the types the manifest files under `tier: free`; **[[Pro]]
 * registers the premium ones** by pulling this out of the shared container
 * from its own service provider, exactly as it does with
 * {@see \WConvert\Destination\DestinationRegistry} (ADR 0015). Nobody names a
 * rule type: each side asks the one manifest for the types filed under its own
 * tier, so the premium split still adds **zero new lists**.
 *
 * What falls out of that shape is the whole reason for it. The question
 * {@see Degradation} asks on the enqueue path is *"can this install evaluate
 * `exit_intent`?"* — a set-membership test against a registry, answered by
 * which code ran. It is **not** "is Pro loaded", and it is not a licence: there
 * is no entitlement branch on the request path, which is the exact thing
 * ADR 0004 spends the whole loader design avoiding and what
 * `tests/unit/Contract/NoLicenceOnTheFrontEndTest.php` reads the source to
 * keep true.
 *
 * The grounding is a fact rather than a decision, which is ADR 0015's
 * correction to ADR 0012 read from this end: a plugin either registered its
 * rule types on this request or it did not. A Pro that refused its min-core
 * guard never reaches its provider, so it reads here exactly as a Pro that is
 * not installed — which is what the merchant is in fact getting.
 *
 * **It cannot say WHY a type is missing**, and deliberately does not try: the
 * code that did not run cannot say why it did not
 * ({@see \WConvert\Destination\DestinationRegistry::availabilityOf()} makes the
 * same point). The front end does not need to know — it needs "shown or not".
 * The cause is a sentence for one screen, and it is resolved there, from the
 * [[Availability]] arithmetic that already exists ({@see \WConvert\Optin\Suspension}).
 *
 * @since 0.1.0
 */
final class SuppliedRules
{
    /** @var array<string, true> Rule type => this install can evaluate it. */
    private array $types = [];

    public function add(string ...$types): self
    {
        foreach ($types as $type) {
            $this->types[$type] = true;
        }

        return $this;
    }

    public function supplies(string $type): bool
    {
        return isset($this->types[$type]);
    }

    /**
     * Every type registered, sorted — for the tests and for nothing else.
     *
     * @return list<string>
     */
    public function all(): array
    {
        $types = array_keys($this->types);

        sort($types);

        return $types;
    }
}
