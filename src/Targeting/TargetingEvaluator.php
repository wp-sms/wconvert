<?php

namespace WConvert\Targeting;

defined('ABSPATH') || exit;

/**
 * Does this Optin's Targeting admit this request?
 *
 * Pure, and deliberately so: Targeting is the one axis evaluated on the server
 * (CONTEXT.md), on every uncached page load, so it must be cheap and it must
 * be testable without a WordPress install.
 *
 * @since 0.1.0
 */
final class TargetingEvaluator
{
    public static function matches(Targeting $targeting, RequestContext $context): bool
    {
        if ($targeting->selected && $targeting->include === []) return false;
        if ($targeting->loggedIn !== null && $targeting->loggedIn !== $context->isLoggedIn) {
            return false;
        }

        // ANY of them, never all: the real OR cases are one rule carrying
        // several values (ADR 0005), and nobody holds two membership levels
        // and one WordPress role at once by design. Null is *do not ask*; an
        // empty list cannot arise, because `Targeting::fromArray()` collapses
        // one to null rather than store a set nobody can satisfy.
        if ($targeting->roles !== null && array_intersect($targeting->roles, $context->roles) === []) {
            return false;
        }

        // Exclude first, and unconditionally: the exclude list is not a filter
        // applied to the include list's result, it is a veto over the whole
        // axis. Checking include first and letting exclude "subtract" reads
        // the same until both lists match the same page.
        foreach ($targeting->exclude as $rule) {
            if (self::ruleMatches($rule, $context)) {
                return false;
            }
        }

        // An Optin the merchant never restricted is site-wide. "Nowhere" would
        // make an exclude-only list — everywhere except the checkout — mean
        // nothing at all.
        if ($targeting->include === []) {
            return true;
        }

        foreach ($targeting->include as $rule) {
            if (self::ruleMatches($rule, $context)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Does this ONE rule match?
     *
     * Public because the eligibility inspector reports the per-rule table
     * ADR 0005 predicted — *"a flat list yields a readable per-rule pass/fail
     * table"* — and it must read the same answers this evaluator gave rather
     * than compute its own. {@see \WConvert\Targeting\TargetingExplainer}
     * takes the VERDICT from {@see self::matches()} and only the per-rule
     * detail from here, so a table that disagreed with the verdict would be a
     * bug in the explainer rather than two implementations drifting.
     */
    public static function ruleMatches(TargetingRule $rule, RequestContext $context): bool
    {
        return match ($rule->type) {
            TargetingType::Post => $context->isSingular && (string) $context->postId === $rule->value,
            TargetingType::Singular => $context->isSingular && $context->postType === $rule->value,
            TargetingType::Archive => $context->archivePostType === $rule->value,
            TargetingType::Term => in_array($rule->value, array_map('strval', $context->termIds), true),
            TargetingType::Url => PathGlob::matches($rule->value, $context->path),
        };
    }
}
