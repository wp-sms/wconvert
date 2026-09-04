<?php

namespace WConvert\Rules;

defined('ABSPATH') || exit;

/**
 * What a rule type IS, across all three axes of ADR 0005.
 *
 * Kind is a fixed property of the type, never of the entry — `scroll_depth`
 * means "when they reach half way" and there is no second spelling meaning "if
 * they already had" (CONTEXT.md, Trigger). That fixedness is what lets the
 * partition happen once at publish time instead of on every page view.
 *
 * All four cases in one enum rather than one enum per axis, because the
 * manifest is one file and the question asked of it — "what kind is this
 * type?" — is one question. {@see RuleVocabulary::partition()} is what cares
 * that `page` and `visitor` are the server's and the other two are the
 * client's.
 *
 * @since 0.1.0
 */
enum RuleKind: string
{
    /** Targeting, page-set half — evaluated by PHP at enqueue, never shipped. */
    case Page = 'page';

    /**
     * Targeting, visitor half — `logged_in` and `role`, each held as a FIELD
     * beside the two lists rather than as a member of either.
     *
     * The lists union page SETS, so a visitor rule in one would widen the
     * Optin to the whole site for anyone matching it. `TargetingType`
     * enumerates the page rules and nothing else, which is what makes that
     * unbuildable rather than merely discouraged.
     */
    case Visitor = 'visitor';

    /** WHEN an Optin fires. Any one is enough. */
    case Trigger = 'trigger';

    /** WHETHER a visitor is eligible. All must hold, at the instant a Trigger fires. */
    case Condition = 'condition';
}
