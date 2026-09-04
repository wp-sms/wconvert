<?php

namespace WConvert\Tests\Unit\Targeting;

use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use WConvert\Targeting\RequestContext;
use WConvert\Targeting\Targeting;
use WConvert\Targeting\TargetingEvaluator;
use WConvert\Targeting\TargetingExplainer;

/**
 * The server half of the eligibility inspector.
 *
 * ============================================================================
 * WHAT IS UNDER TEST IS THAT IT NEVER DISAGREES WITH THE EVALUATOR.
 * ============================================================================
 * A diagnostic that computes its own answer can be wrong about the very thing
 * it exists to explain, and the merchant would believe the screen over the
 * site. So the verdict is {@see TargetingEvaluator::matches()}'s and only the
 * per-rule detail is this class's — and the exhaustive case below is what
 * holds the two together across every shape of Targeting the model allows.
 */
#[CoversClass(TargetingExplainer::class)]
final class TargetingExplainerTest extends TestCase
{
    /**
     * @param array<string, mixed> $over
     */
    private static function context(array $over = []): RequestContext
    {
        return new RequestContext(
            path: $over['path'] ?? '/pricing',
            isSingular: $over['isSingular'] ?? true,
            postId: $over['postId'] ?? 42,
            postType: $over['postType'] ?? 'page',
            archivePostType: $over['archivePostType'] ?? null,
            termIds: $over['termIds'] ?? [],
            isLoggedIn: $over['isLoggedIn'] ?? false,
            roles: $over['roles'] ?? [],
        );
    }

    public function testAnUnrestrictedOptinIsAdmittedEverywhereWithNoReason(): void
    {
        $report = TargetingExplainer::explain(Targeting::fromArray([]), self::context());

        $this->assertTrue($report['admits']);
        $this->assertNull($report['reason']);
        $this->assertSame([], $report['include']);
        $this->assertSame([], $report['exclude']);
        $this->assertNull($report['logged_in']);
    }

    /** Every rule gets a row, matching or not — that is what makes it a table. */
    public function testItReportsEveryRuleOnBothLists(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray([
                'include' => [
                    ['type' => 'url', 'value' => '/pricing'],
                    ['type' => 'url', 'value' => '/about'],
                ],
                'exclude' => [['type' => 'post', 'value' => '99']],
            ]),
            self::context()
        );

        $this->assertTrue($report['admits']);
        $this->assertSame(
            [
                ['type' => 'url', 'value' => '/pricing', 'matches' => true],
                ['type' => 'url', 'value' => '/about', 'matches' => false],
            ],
            $report['include']
        );
        $this->assertSame([['type' => 'post', 'value' => '99', 'matches' => false]], $report['exclude']);
    }

    /**
     * **Exclude is a veto, not a filter over the include list's result**, and
     * the reason has to say so: a merchant told to fix their include list when
     * the checkout is in their exclude list is worse off than one told nothing.
     */
    public function testAnExcludedPageNamesTheExcludeListEvenWhenIncludeMatchedToo(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray([
                'include' => [['type' => 'url', 'value' => '/pricing']],
                'exclude' => [['type' => 'url', 'value' => '/pricing']],
            ]),
            self::context()
        );

        $this->assertFalse($report['admits']);
        $this->assertSame(TargetingExplainer::EXCLUDED, $report['reason']);
        // Both rows are still true. The table reports what each rule did; the
        // reason reports which gate closed.
        $this->assertTrue($report['include'][0]['matches']);
        $this->assertTrue($report['exclude'][0]['matches']);
    }

    public function testANonEmptyIncludeListThatMatchesNothingNamesItself(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray(['include' => [['type' => 'url', 'value' => '/about']]]),
            self::context()
        );

        $this->assertFalse($report['admits']);
        $this->assertSame(TargetingExplainer::NOT_INCLUDED, $report['reason']);
    }

    /**
     * ========================================================================
     * THE ONE QUESTION THE INSPECTOR CANNOT SIMULATE, REPORTED AS A FACT ABOUT
     * THIS REQUEST.
     * ========================================================================
     * The merchant is signed in — that is what grants them `manage_options` —
     * so "what does a signed-out visitor see" is unanswerable and must be said
     * rather than faked. The predicate is reported as *wanted* against *holds*
     * so the panel can say "this shows only to signed-out visitors, and you
     * are signed in".
     */
    public function testTheVisitorPredicateIsReportedAsWantedAgainstThisRequest(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray(['logged_in' => false]),
            self::context(['isLoggedIn' => true])
        );

        $this->assertFalse($report['admits']);
        $this->assertSame(TargetingExplainer::WRONG_VISITOR, $report['reason']);
        $this->assertSame(['wanted' => false, 'holds' => false], $report['logged_in']);
    }

    /** And the predicate wins over the lists, because the evaluator asks it first. */
    public function testTheVisitorPredicateNamesItselfEvenWhenTheListsWouldAlsoRefuse(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray(['logged_in' => true, 'include' => [['type' => 'url', 'value' => '/about']]]),
            self::context()
        );

        $this->assertSame(TargetingExplainer::WRONG_VISITOR, $report['reason']);
    }

    /**
     * **The roles are reported the same way, and the same thing is said out
     * loud**: the merchant is signed in as themselves, so *"what does a
     * subscriber see"* is unanswerable here. Both halves travel — what the
     * Optin wants and what this request holds — so the panel can say which.
     */
    public function testTheRolePredicateIsReportedAsWantedAgainstThisRequest(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray(['roles' => ['subscriber']]),
            self::context(['isLoggedIn' => true, 'roles' => ['administrator']])
        );

        $this->assertFalse($report['admits']);
        $this->assertSame(TargetingExplainer::WRONG_ROLE, $report['reason']);
        $this->assertSame(
            ['wanted' => ['subscriber'], 'held' => ['administrator'], 'holds' => false],
            $report['roles']
        );
    }

    /**
     * **`logged_in` is named before `roles`.**
     *
     * A signed-out visitor holds no role, so an Optin wanting both refuses on
     * both — and telling the merchant about the roles would send them to a
     * list when what they needed was the sign-in question above it.
     */
    public function testTheSignInQuestionIsNamedBeforeTheRoles(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray(['logged_in' => true, 'roles' => ['subscriber']]),
            self::context(['isLoggedIn' => false, 'roles' => []])
        );

        $this->assertSame(TargetingExplainer::WRONG_VISITOR, $report['reason']);
    }

    /** And the roles win over the lists, because the evaluator asks them first. */
    public function testTheRolePredicateNamesItselfEvenWhenTheListsWouldAlsoRefuse(): void
    {
        $report = TargetingExplainer::explain(
            Targeting::fromArray(['roles' => ['subscriber'], 'include' => [['type' => 'url', 'value' => '/about']]]),
            self::context()
        );

        $this->assertSame(TargetingExplainer::WRONG_ROLE, $report['reason']);
    }

    /** Nothing chosen is nothing reported, which is what the panel draws off. */
    public function testAnOptinThatDoesNotAskAboutRolesReportsNone(): void
    {
        $report = TargetingExplainer::explain(Targeting::fromArray([]), self::context());

        $this->assertNull($report['roles']);
    }

    /**
     * ========================================================================
     * THE VERDICT IS THE EVALUATOR'S, ACROSS EVERY SHAPE THE MODEL ALLOWS.
     * ========================================================================
     * Two lists of nought, one or two rules, each matching or not, against the
     * three states of `logged_in`, the two of `roles`, and both answers this
     * request could give to each. What this holds is that
     * `admits` never disagrees with {@see TargetingEvaluator::matches()} and
     * that `reason` is null on exactly the ones it admits — the pair that
     * cannot occur is a positive verdict carrying a cause.
     */
    public function testItNeverDisagreesWithTheEvaluatorItExplains(): void
    {
        $matching = ['type' => 'url', 'value' => '/pricing'];
        $missing = ['type' => 'url', 'value' => '/about'];
        $lists = [[], [$matching], [$missing], [$matching, $missing]];
        $checked = 0;

        foreach ($lists as $include) {
            foreach ($lists as $exclude) {
                foreach ([null, true, false] as $loggedIn) {
                    foreach ([true, false] as $visitorIsSignedIn) {
                        foreach ([null, ['subscriber']] as $roles) {
                            foreach ([[], ['subscriber']] as $held) {
                                $config = ['include' => $include, 'exclude' => $exclude];

                                if ($loggedIn !== null) {
                                    $config['logged_in'] = $loggedIn;
                                }

                                if ($roles !== null) {
                                    $config['roles'] = $roles;
                                }

                                $targeting = Targeting::fromArray($config);
                                $context = self::context([
                                    'isLoggedIn' => $visitorIsSignedIn,
                                    'roles' => $held,
                                ]);
                                $report = TargetingExplainer::explain($targeting, $context);
                                $where = (string) json_encode([$config, $visitorIsSignedIn, $held]);

                                $this->assertSame(
                                    TargetingEvaluator::matches($targeting, $context),
                                    $report['admits'],
                                    $where
                                );
                                $this->assertSame($report['admits'], $report['reason'] === null, $where);

                                $checked++;
                            }
                        }
                    }
                }
            }
        }

        $this->assertSame(384, $checked);
    }
}
