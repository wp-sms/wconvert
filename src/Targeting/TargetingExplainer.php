<?php

namespace WConvert\Targeting;

defined('ABSPATH') || exit;

/**
 * Why this page's Targeting admitted an Optin, or did not — rule by rule.
 *
 * ============================================================================
 * THE VERDICT IS {@see TargetingEvaluator::matches()}'s. NOTHING HERE
 * RE-DERIVES IT.
 * ============================================================================
 * A diagnostic that computes its own answer is a diagnostic that can be
 * wrong about the thing it exists to explain — and the merchant would believe
 * the screen over the site. So the verdict is asked of the evaluator that
 * actually decided, and what this adds is the per-rule detail underneath it:
 * `ruleMatches()` was made public for exactly that, so both halves come from
 * one implementation.
 *
 * ADR 0005 predicted this screen — *"a flat list yields a readable per-rule
 * pass/fail table"* — and it was never built. The rule model is flat and
 * unnested precisely so that the table is a table.
 *
 * **Pure, with no WordPress in it**, like the evaluator it wraps. It is handed
 * a {@see RequestContext} that has already been built from the real request;
 * building one from a URL is the thing the inspector explicitly refuses to do,
 * because `url_to_postid()` returns 0 for archives, terms, the blog index and
 * the shop page — so `archivePostType` would be permanently null and the
 * screen would confidently explain a page nobody is on.
 *
 * **No words.** Everything here is a boolean or a key, and
 * {@see \WConvert\Frontend\InspectorLabels} mints the sentences — `wp i18n
 * make-pot` cannot see a string in a TypeScript bundle.
 *
 * @since 0.1.0
 */
final class TargetingExplainer
{
    /** The exclude list vetoed it. Checked first, because exclude is a veto. */
    public const EXCLUDED = 'excluded';

    /** The include list is not empty and nothing in it matched. */
    public const NOT_INCLUDED = 'not_included';

    /** `logged_in` is set and this visitor is the other one. */
    public const WRONG_VISITOR = 'wrong_visitor';

    /**
     * One Optin's Targeting, against this request.
     *
     * @return array{
     *     admits: bool,
     *     reason: string|null,
     *     logged_in: array{wanted: bool, holds: bool}|null,
     *     include: list<array{type: string, value: string, matches: bool}>,
     *     exclude: list<array{type: string, value: string, matches: bool}>
     * }
     */
    public static function explain(Targeting $targeting, RequestContext $context): array
    {
        $include = self::rows($targeting->include, $context);
        $exclude = self::rows($targeting->exclude, $context);

        $loggedIn = $targeting->loggedIn === null
            ? null
            : ['wanted' => $targeting->loggedIn, 'holds' => $targeting->loggedIn === $context->isLoggedIn];

        // THE verdict, not A verdict.
        $admits = TargetingEvaluator::matches($targeting, $context);

        return [
            'admits' => $admits,
            // Null exactly when it was admitted, so a caller never has to hold
            // a reason beside a positive verdict — the pair that cannot occur.
            'reason' => $admits ? null : self::reason($loggedIn, $include, $exclude),
            'logged_in' => $loggedIn,
            'include' => $include,
            'exclude' => $exclude,
        ];
    }

    /**
     * Which gate closed.
     *
     * **In the evaluator's own order**, which is the only order that can agree
     * with its verdict: the visitor predicate first, then exclude as an
     * unconditional veto, then include. Reading them in any other order would
     * name the wrong cause on a page that fails two of them at once — and a
     * merchant told to fix the include list when the checkout is in their
     * exclude list is worse off than one told nothing.
     *
     * @param array{wanted: bool, holds: bool}|null $loggedIn
     * @param list<array{type: string, value: string, matches: bool}> $include
     * @param list<array{type: string, value: string, matches: bool}> $exclude
     */
    private static function reason(?array $loggedIn, array $include, array $exclude): ?string
    {
        if ($loggedIn !== null && !$loggedIn['holds']) {
            return self::WRONG_VISITOR;
        }

        foreach ($exclude as $row) {
            if ($row['matches']) {
                return self::EXCLUDED;
            }
        }

        // An empty include list is "everywhere", never "nowhere" — the only
        // reading under which an exclude-only Optin means anything.
        return $include === [] ? null : self::NOT_INCLUDED;
    }

    /**
     * @param list<TargetingRule> $rules
     * @return list<array{type: string, value: string, matches: bool}>
     */
    private static function rows(array $rules, RequestContext $context): array
    {
        return array_map(
            static fn (TargetingRule $rule): array => [
                'type' => $rule->type->value,
                'value' => $rule->value,
                'matches' => TargetingEvaluator::ruleMatches($rule, $context),
            ],
            $rules
        );
    }
}
